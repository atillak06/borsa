"""
Extensible indicator framework for BIST market scanning.

All indicators from the TypeScript frontend are ported here to Python/numpy
so they can be computed server-side for 500+ symbols in parallel.

To add a new indicator:
  1. Create a class extending BaseIndicator
  2. Implement the compute() method
  3. Append an instance to INDICATOR_REGISTRY
"""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import numpy as np


# ──────────────────────────────────────────────
# Data classes
# ──────────────────────────────────────────────

@dataclass
class IndicatorResult:
    """Standardized result from any indicator."""
    name: str
    label: str
    score: float
    signal: str        # "bullish" | "bearish" | "neutral"
    details: dict[str, Any] = field(default_factory=dict)


class BaseIndicator(ABC):
    """Abstract base — every indicator must implement compute()."""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def label(self) -> str: ...

    @abstractmethod
    def compute(
        self,
        opens: np.ndarray,
        highs: np.ndarray,
        lows: np.ndarray,
        closes: np.ndarray,
        volumes: np.ndarray,
    ) -> IndicatorResult | None:
        """Return result or None if insufficient data."""
        ...


# ──────────────────────────────────────────────
# Helper functions (ported from indicators.ts)
# ──────────────────────────────────────────────

def ema(src: np.ndarray, period: int) -> np.ndarray:
    """Exponential moving average — mirrors indicators.ts:9-25."""
    out = np.full(len(src), np.nan)
    k = 2.0 / (period + 1)
    prev = None
    for i in range(len(src)):
        v = src[i]
        if np.isnan(v):
            continue
        if prev is None:
            prev = v
        else:
            prev = v * k + prev * (1 - k)
        out[i] = prev
    return out


def rolling_highest(highs: np.ndarray, period: int) -> np.ndarray:
    """Rolling highest high — mirrors indicators.ts:28-35."""
    n = len(highs)
    out = np.full(n, np.nan)
    for i in range(period - 1, n):
        out[i] = np.max(highs[max(0, i - period + 1):i + 1])
    return out


def rolling_lowest(lows: np.ndarray, period: int) -> np.ndarray:
    """Rolling lowest low — mirrors indicators.ts:38-45."""
    n = len(lows)
    out = np.full(n, np.nan)
    for i in range(period - 1, n):
        out[i] = np.min(lows[max(0, i - period + 1):i + 1])
    return out


def vwma(src: np.ndarray, volumes: np.ndarray, period: int) -> np.ndarray:
    """Volume-weighted moving average — mirrors indicators.ts:90-108."""
    n = len(src)
    out = np.full(n, np.nan)
    for i in range(period - 1, n):
        window_src = src[i - period + 1:i + 1]
        window_vol = volumes[i - period + 1:i + 1]
        if np.any(np.isnan(window_src)):
            continue
        sum_v = np.sum(window_vol)
        if sum_v > 0:
            out[i] = np.sum(window_src * window_vol) / sum_v
    return out


# ──────────────────────────────────────────────
# Pearson channel helpers (ported from regressionChannels.ts)
# ──────────────────────────────────────────────

def cumulative_sum(src: np.ndarray) -> np.ndarray:
    """mirrors regressionChannels.ts:159-167."""
    return np.cumsum(src)


def _cs(arr: np.ndarray, i: int) -> float:
    """Safe cumulative sum accessor — returns 0 for negative indices."""
    if i < 0:
        return 0.0
    return float(arr[i])


def compute_r2(
    cmla: np.ndarray,
    cmlb: np.ndarray,
    cmlc: np.ndarray,
    n: int,
    p: int,
) -> float:
    """Compute R² — mirrors regressionChannels.ts:194-218."""
    if n - p < -1:
        return 0.0

    sum_val = _cs(cmlb, n) - _cs(cmlb, n - p)
    a = p * _cs(cmla, n) - sum_val
    b = _cs(cmla, n) - _cs(cmla, n - p)
    c = _cs(cmlc, n) - _cs(cmlc, n - p)

    num = (a - b * (p + 1) / 2) / p
    vary = c / p - (b / p) ** 2
    varx = (p * p - 1) / 12

    if vary <= 0 or varx <= 0:
        return 0.0
    denom = math.sqrt(vary * varx)
    if denom == 0:
        return 0.0

    return (num / denom) ** 2


def compute_channel(
    closes: np.ndarray,
    ch_id: str,
    min_period: int,
    max_period: int,
    mult: float = 2.0,
) -> dict | None:
    """Compute one regression channel — mirrors regressionChannels.ts:223-308.

    Returns a dict with: id, period, pearson, slope, rmse, startMid, endMid
    or None if insufficient data.
    """
    n_idx = len(closes) - 1  # last bar index
    if n_idx < min_period:
        return None

    # Build cumulative arrays
    cmla = cumulative_sum(closes)

    shifted = np.zeros(len(closes))
    shifted[0] = 0.0
    shifted[1:] = cmla[:-1]
    cmlb = cumulative_sum(shifted)

    src_sq = closes ** 2
    cmlc = cumulative_sum(src_sq)

    # Find best period
    best_r2 = 0.0
    best_p = min_period
    max_p = min(max_period, n_idx)

    for p in range(min_period, max_p + 1):
        r2 = compute_r2(cmla, cmlb, cmlc, n_idx, p)
        if r2 > best_r2:
            best_r2 = r2
            best_p = p

    p = best_p
    if p <= 0:
        return None

    # Regression line endpoints
    den = p * (p + 1) / 2
    sum_p = _cs(cmlb, n_idx) - _cs(cmlb, n_idx - p)
    wma_val = (p * _cs(cmla, n_idx) - sum_p) / den
    sma_val = (_cs(cmla, n_idx) - _cs(cmla, n_idx - p)) / p
    A = 4 * sma_val - 3 * wma_val  # start value
    B = 3 * wma_val - 2 * sma_val  # end value

    # RMSE
    c_val = _cs(cmlc, n_idx) - _cs(cmlc, n_idx - p)
    b_val = _cs(cmla, n_idx) - _cs(cmla, n_idx - p)
    variance = c_val / p - (b_val / p) ** 2
    r2_at_best = compute_r2(cmla, cmlb, cmlc, n_idx, p)
    rmse = math.sqrt(max(0, variance - r2_at_best * variance))

    # Pearson correlation
    pearson = math.sqrt(r2_at_best)
    if B - A < 0:
        pearson = -pearson

    slope = (B - A) / (p - 1) if p > 1 else 0.0

    return {
        "id": ch_id,
        "period": p,
        "pearson": pearson,
        "slope": slope,
        "rmse": rmse,
        "startMid": A,
        "endMid": B,
    }


# ──────────────────────────────────────────────
# Indicator implementations
# ──────────────────────────────────────────────

class WilliamsRIndicator(BaseIndicator):
    """Williams %R — ported from indicators.ts:60-84."""

    @property
    def name(self) -> str:
        return "williams_r"

    @property
    def label(self) -> str:
        return "Williams %R"

    def compute(self, opens, highs, lows, closes, volumes) -> IndicatorResult | None:
        length = 260
        ema_period = 260
        n = len(closes)
        if n < length:
            return None

        hh = rolling_highest(highs, length)
        ll = rolling_lowest(lows, length)

        wr = np.full(n, np.nan)
        for i in range(length - 1, n):
            rng = hh[i] - ll[i]
            if rng == 0:
                wr[i] = -50.0
            else:
                wr[i] = 100.0 * (closes[i] - hh[i]) / rng

        ema_line = ema(wr, ema_period)

        wr_last = float(wr[-1]) if not np.isnan(wr[-1]) else None
        ema_last = float(ema_line[-1]) if not np.isnan(ema_line[-1]) else None

        if wr_last is None:
            return None

        # Score: normalize WR from [-100, 0] to [-1, +1]
        score = (wr_last + 50) / 50.0

        # Signal: WR vs EMA crossover + zone thresholds
        # WR above EMA = upward momentum, below = downward
        if ema_last is not None and wr_last > ema_last and wr_last > -70:
            signal = "bullish"
        elif ema_last is not None and wr_last < ema_last and wr_last < -30:
            signal = "bearish"
        else:
            signal = "neutral"

        return IndicatorResult(
            name=self.name,
            label=self.label,
            score=round(score, 4),
            signal=signal,
            details={
                "wr_last": round(wr_last, 2),
                "ema_last": round(ema_last, 2) if ema_last is not None else None,
            },
        )


class NizamiCedidIndicator(BaseIndicator):
    """NizamiCedid (3. Selim) — ported from indicators.ts:136-213."""

    @property
    def name(self) -> str:
        return "nizami_cedid"

    @property
    def label(self) -> str:
        return "3. Selim"

    def compute(self, opens, highs, lows, closes, volumes) -> IndicatorResult | None:
        n = len(closes)
        if n < 260:
            return None

        fast_ma = ema(closes, 120)
        slow_ma = ema(closes, 260)
        ema377 = ema(closes, 377)
        ema610 = ema(closes, 610)

        # MACD = fast - slow
        macd_raw = fast_ma - slow_ma

        # Signal = EMA(macd, 50)
        signal_raw = ema(macd_raw, 50)

        # Hist = macd - signal
        hist_raw = macd_raw - signal_raw

        # eMacD = VWMA(macd, 185)
        emacd_raw = vwma(macd_raw, volumes, 185)

        # deltaMACEMAC
        delta_raw = macd_raw - emacd_raw

        # Normalize by fast_ma
        def safe_last(arr, fm):
            idx = n - 1
            if np.isnan(arr[idx]) or np.isnan(fm[idx]) or fm[idx] == 0:
                return None
            return float(arr[idx] / fm[idx])

        hist_norm = safe_last(hist_raw, fast_ma)
        macd_norm = safe_last(macd_raw, fast_ma)
        delta_norm = safe_last(delta_raw, fast_ma)

        # Kondisyon: EMA(377) > EMA(610)
        kondisyon = None
        if not np.isnan(ema377[-1]) and not np.isnan(ema610[-1]):
            kondisyon = bool(ema377[-1] > ema610[-1])

        if hist_norm is None:
            return None

        score = max(-1.0, min(1.0, hist_norm * 100))  # scale for visibility

        if hist_norm > 0 and kondisyon is True:
            signal = "bullish"
        elif hist_norm < 0 and kondisyon is False:
            signal = "bearish"
        else:
            signal = "neutral"

        return IndicatorResult(
            name=self.name,
            label=self.label,
            score=round(score, 4),
            signal=signal,
            details={
                "hist": round(hist_norm, 6) if hist_norm is not None else None,
                "kondisyon": kondisyon,
                "deltaMACEMAC": round(delta_norm, 6) if delta_norm is not None else None,
                "macd": round(macd_norm, 6) if macd_norm is not None else None,
            },
        )


class MATLRNSIndicator(BaseIndicator):
    """MATLRNS — ported from indicators.ts:236-285."""

    @property
    def name(self) -> str:
        return "matlrns"

    @property
    def label(self) -> str:
        return "MATLRNS"

    def compute(self, opens, highs, lows, closes, volumes) -> IndicatorResult | None:
        n = len(closes)
        fast_len = 8
        slow_len = 21
        tolerance = 9

        if n < slow_len + tolerance:
            return None

        # source = hlcc4
        hlcc4 = (highs + lows + closes + closes) / 4.0
        fast_ma = ema(hlcc4, fast_len)
        slow_ma = ema(hlcc4, slow_len)

        quantize = lambda k: 1 if k > 0 else (-1 if k < 0 else 0)

        direction = np.full(n, np.nan)
        for i in range(tolerance, n):
            if np.isnan(fast_ma[i]) or np.isnan(slow_ma[i]):
                continue
            if np.isnan(fast_ma[i - tolerance]) or np.isnan(slow_ma[i - tolerance]):
                continue

            fast_dir = quantize(fast_ma[i] - fast_ma[i - tolerance])
            slow_dir = quantize(slow_ma[i] - slow_ma[i - tolerance])

            # Price warning
            close_diff = closes[i] - fast_ma[i]
            if close_diff < 0:
                fast_dir = min(fast_dir, -1)
            if close_diff > 0:
                fast_dir = max(fast_dir, 1)

            direction[i] = fast_dir + slow_dir

        last_dir = float(direction[-1]) if not np.isnan(direction[-1]) else None
        if last_dir is None:
            return None

        score = last_dir / 2.0  # normalize -2..+2 to -1..+1

        if last_dir >= 1:
            signal = "bullish"
        elif last_dir <= -1:
            signal = "bearish"
        else:
            signal = "neutral"

        return IndicatorResult(
            name=self.name,
            label=self.label,
            score=round(score, 4),
            signal=signal,
            details={
                "direction": int(last_dir),
            },
        )


class PearsonChannelIndicator(BaseIndicator):
    """Pearson regression channel — ported from regressionChannels.ts."""

    def __init__(self, ch_id: str, ch_label: str, min_period: int, max_period: int, mult: float = 2.0):
        self._id = ch_id
        self._label = ch_label
        self._min = min_period
        self._max = max_period
        self._mult = mult

    @property
    def name(self) -> str:
        return f"pearson_{self._id}"

    @property
    def label(self) -> str:
        return self._label

    def compute(self, opens, highs, lows, closes, volumes) -> IndicatorResult | None:
        ch = compute_channel(closes, self._id, self._min, self._max, self._mult)
        if ch is None:
            return None

        pearson = ch["pearson"]
        score = pearson  # already in -1..+1

        if pearson > 0.5:
            signal = "bullish"
        elif pearson < -0.5:
            signal = "bearish"
        else:
            signal = "neutral"

        return IndicatorResult(
            name=self.name,
            label=self.label,
            score=round(score, 4),
            signal=signal,
            details={
                "period": ch["period"],
                "slope": round(ch["slope"], 6),
                "pearson": round(pearson, 4),
                "rmse": round(ch["rmse"], 4),
            },
        )


class EMATrendIndicator(BaseIndicator):
    """EMA trend classification — new indicator for market-wide analysis."""

    @property
    def name(self) -> str:
        return "ema_trend"

    @property
    def label(self) -> str:
        return "EMA Trend"

    def compute(self, opens, highs, lows, closes, volumes) -> IndicatorResult | None:
        n = len(closes)
        if n < 144:
            return None

        ema21 = ema(closes, 21)
        ema55 = ema(closes, 55)
        ema144 = ema(closes, 144)

        e21 = float(ema21[-1]) if not np.isnan(ema21[-1]) else None
        e55 = float(ema55[-1]) if not np.isnan(ema55[-1]) else None
        e144 = float(ema144[-1]) if not np.isnan(ema144[-1]) else None

        if e21 is None or e55 is None or e144 is None:
            return None

        if e21 > e55 > e144:
            signal = "ideal_up"
            score = 1.0
        elif e21 > e55:
            signal = "up"
            score = 0.5
        elif e21 < e55 < e144:
            signal = "ideal_down"
            score = -1.0
        elif e21 < e55:
            signal = "down"
            score = -0.5
        else:
            signal = "neutral"
            score = 0.0

        return IndicatorResult(
            name=self.name,
            label=self.label,
            score=score,
            signal=signal,
            details={
                "ema21": round(e21, 2),
                "ema55": round(e55, 2),
                "ema144": round(e144, 2),
            },
        )


# ──────────────────────────────────────────────
# Indicator Registry
# ──────────────────────────────────────────────

INDICATOR_REGISTRY: list[BaseIndicator] = [
    WilliamsRIndicator(),
    NizamiCedidIndicator(),
    MATLRNSIndicator(),
    PearsonChannelIndicator("ch3", "Pearson 21-34", 21, 34, 2),
    PearsonChannelIndicator("ch1", "Pearson 55-89", 55, 89, 2),
    PearsonChannelIndicator("ch2", "Pearson 144-233", 144, 233, 2),
    PearsonChannelIndicator("ch4", "Pearson 377-610", 377, 610, 2),
    EMATrendIndicator(),
]


def compute_all_indicators(
    opens: np.ndarray,
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
    volumes: np.ndarray,
) -> list[IndicatorResult]:
    """Run all registered indicators, returning only successful results."""
    results: list[IndicatorResult] = []
    for ind in INDICATOR_REGISTRY:
        try:
            r = ind.compute(opens, highs, lows, closes, volumes)
            if r is not None:
                results.append(r)
        except Exception:
            pass
    return results
