# BIST Borsa Analiz

Borsa Istanbul (BIST) hisse senetleri icin teknik ve temel analiz araci.

**Canli:** [ozdoganosman.github.io/borsa](https://ozdoganosman.github.io/borsa/)

## Ozellikler

- Mum grafigi (gunluk, haftalik, aylik, ceyreklik periyotlar)
- Teknik indikatorler (Kanallar, Williams %R, Nizam-i Cedid, MATLRNS)
- Coklu grafik gorunumu
- Piyasa analizi (Pearson korelasyonu, momentum, EMA dagilimi)
- Backtest araci
- Finansal analiz sayfasi (F/K, PD/DD, ROE, karlilik marjlari, bilanco, nakit akis grafikleri)
- Takip listesi ve alarm sistemi
- Acik/koyu tema destegi
- PWA (Progressive Web App) destegi

## Veri Kaynaklari

Bu proje asagidaki acik kaynak kutuphaneler ve veri kaynaklari uzerinden calismaktadir:

| Kaynak | Kullanim Alani | Lisans |
|--------|----------------|--------|
| [borsapy](https://github.com/borsapy/borsapy) | Tarihi OHLCV fiyat verileri | MIT |
| [isyatirimhisse](https://github.com/urazakgul/isyatirimhisse) | Finansal tablolar (gelir tablosu, bilanco, nakit akis) | MIT |

**Not:** Veriler yalnizca bilgilendirme amaclidir. Gercek zamanli degil, gecikmelidir.
Verilerin dogrulugu, eksiksizligi veya guncelligi garanti edilmez.

## Teknoloji

- **Frontend:** React + TypeScript + Vite
- **Grafikler:** Apache ECharts
- **Veri:** Statik JSON (Python ile on-derleme) + GitHub Pages
- **CI/CD:** GitHub Actions (gunluk veri guncelleme)

## Kurulum

```bash
# Bagimliklar
npm install
pip install -r requirements.txt

# Veri olusturma
python scripts/build_data.py

# Gelistirme sunucusu
npm run dev
```

## Yasal Uyari / Feragatname

**Bu site yalnizca bilgilendirme amaciyla hazirlanmistir ve hicbir sekilde yatirim tavsiyesi, oneri veya yonlendirme niteligi tasimaz.**

- Sunulan veriler gecikmelidir ve dogrulugu garanti edilmez.
- Yatirim kararlari tamamen kullanicinin kendi sorumlulugundadir.
- Bu arac ile yapilan analizler sonucunda olusabilecek kayiplardan site sahibi sorumlu tutulamaz.
- Yatirim yapmadan once mutlaka lisansli bir yatirim danismanina basvurunuz.
- Bu site Sermaye Piyasasi Kurulu (SPK) tarafindan yetkilendirilmis bir kurum degildir.

## Lisans

[MIT](LICENSE)
