# 📈 Borsa Takip

Türk ve ABD borsaları ile kripto para piyasalarını takip etmek için geliştirilmiş bir Streamlit uygulaması.

[![CI](https://github.com/ozdoganosman/borsa/actions/workflows/ci.yml/badge.svg)](https://github.com/ozdoganosman/borsa/actions/workflows/ci.yml)

## 🚀 Özellikler

- **Piyasa Takibi**: BIST, ABD ve kripto piyasalarından anlık fiyat bilgileri
- **Teknik Analiz**: SMA, EMA, RSI, MACD ve Bollinger Bantları göstergeleri
- **MACD Paşa (NizamiCedid)**: Özel geliştirilmiş teknik analiz indikatörü
- **Portföy Yönetimi**: Alış/satış işlemleri ve kar/zarar takibi
- **Watchlist**: Takip etmek istediğiniz hisseleri listeleyin

## 📋 Gereksinimler

- Python 3.9+
- pip paket yöneticisi

## 🛠️ Kurulum

### Yerel Kurulum

1. Repoyu klonlayın:
```bash
git clone https://github.com/ozdoganosman/borsa.git
cd borsa
```

2. Sanal ortam oluşturun (önerilir):
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# veya
venv\Scripts\activate     # Windows
```

3. Bağımlılıkları yükleyin:
```bash
pip install -r requirements.txt
```

4. Uygulamayı çalıştırın:
```bash
streamlit run app.py
```

Uygulama varsayılan olarak `http://localhost:8501` adresinde açılacaktır.

### Streamlit Cloud ile Dağıtım

1. GitHub'da bu repoyu fork edin
2. [Streamlit Cloud](https://streamlit.io/cloud) hesabı oluşturun
3. "New app" butonuna tıklayın
4. GitHub reponuzu seçin
5. Ana dosya olarak `app.py` seçin
6. "Deploy" butonuna tıklayın

## 📁 Proje Yapısı

```
borsa/
├── app.py                 # Ana Streamlit uygulaması
├── config.py              # Uygulama ayarları ve sabit değerler
├── requirements.txt       # Python bağımlılıkları
├── components/            # UI bileşenleri
│   ├── charts.py          # Plotly grafikleri
│   ├── sidebar.py         # Sidebar bileşenleri
│   └── tables.py          # Tablo bileşenleri
├── services/              # İş mantığı servisleri
│   ├── market_data.py     # Piyasa verisi çekme (yfinance)
│   ├── analysis.py        # Teknik analiz hesaplamaları
│   ├── nizami_cedid_analysis.py  # MACD Paşa indikatörü
│   └── portfolio.py       # Portföy hesaplamaları
├── database/              # Veritabanı işlemleri
│   └── db.py              # SQLite veritabanı
├── utils/                 # Yardımcı fonksiyonlar
│   └── helpers.py         # Genel yardımcı fonksiyonlar
├── data/                  # Veri dosyaları (veritabanı)
├── .streamlit/            # Streamlit yapılandırması
│   └── config.toml        # Tema ve sunucu ayarları
└── .github/               # GitHub yapılandırması
    └── workflows/
        └── ci.yml         # CI/CD workflow
```

## 🔧 Yapılandırma

### Teknik Analiz Ayarları

`config.py` dosyasında teknik analiz parametrelerini özelleştirebilirsiniz:

```python
TECHNICAL_SETTINGS = {
    "SMA_PERIODS": [20, 50, 200],
    "EMA_PERIODS": [12, 26],
    "RSI_PERIOD": 14,
    "MACD_FAST": 12,
    "MACD_SLOW": 26,
    "MACD_SIGNAL": 9,
    "BB_PERIOD": 20,
    "BB_STD": 2
}
```

## 📊 NizamiCedid (MACD Paşa) İndikatörü

Bu özel indikatör, klasik MACD'nin geliştirilmiş bir versiyonudur:

- **EMA 120/260**: Hızlı ve yavaş hareketli ortalamalar
- **VWMA 185**: Hacim ağırlıklı MACD ortalaması (eMacD)
- **EMA 377/610**: Uzun vadeli trend belirleme

### Sinyal Yorumlama

| Sinyal | Güç Aralığı | Anlam |
|--------|-------------|-------|
| Güçlü Al | +70 ile +100 | Tüm göstergeler pozitif |
| Al | +40 ile +70 | Çoğu gösterge pozitif |
| Zayıf Al | +15 ile +40 | Hafif pozitif eğilim |
| Nötr | -15 ile +15 | Belirsizlik |
| Zayıf Sat | -40 ile -15 | Hafif negatif eğilim |
| Sat | -70 ile -40 | Çoğu gösterge negatif |
| Güçlü Sat | -100 ile -70 | Tüm göstergeler negatif |

## 🤝 Katkıda Bulunma

1. Bu repoyu fork edin
2. Yeni bir branch oluşturun (`git checkout -b feature/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin feature/yeni-ozellik`)
5. Pull Request açın

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## ⚠️ Sorumluluk Reddi

Bu uygulama yalnızca eğitim amaçlıdır. Yatırım kararlarınızda bu uygulamadaki bilgileri tek başına referans almayın. Finansal kararlarınız için profesyonel danışmanlık alın.
