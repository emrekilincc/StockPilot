# StockPilot teslim raporu

Doğrulama tarihi: **30 Ekim 2026**. Proje, mevcut kişisel dosyalara dokunmadan ayrı `stockpilot/` klasöründe oluşturuldu.

## 1. Tamamlanan özellikler

- Yerel kullanıcı kaydı, yönetici onayı, giriş/çıkış, oturum kontrolü, profil, parola değişimi; admin/employee rolleri ve ürün/stok/sipariş izinleri.
- Gerçek SQL verisiyle dashboard, aylık satış grafiği, sipariş/kategori/stok dağılımı, kritik stok, çok satanlar, son siparişler ve stok hareketleri.
- Ürün oluşturma/düzenleme/detay/arşivleme/geri alma, kategori, tedarikçi, benzersiz SKU, güvenli görsel yükleme; arama, filtreler, sıralama, sayfalama.
- Stok giriş/çıkış/düzeltme; negatif stok engeli, kullanıcı/tarih/not/bakiye geçmişi.
- Çok kalemli sipariş, müşteri seçimi, miktar düzenleme, backend fiyatları, durum ve olay geçmişi, onayda stok düşümü ve iptalde güvenli iade.
- Müşteri/tedarikçi CRUD ekranları, iletişim/adres, aktif/pasif filtreleri, müşteri siparişleri ve tedarikçi ürünleri.
- Yedi rapor türü, tarih filtresi, CSV; kullanıcı yönetimi, işletme ayarları.
- Türkçe responsive arayüz, açık/koyu tema, modal, toast, loading/error/empty durumları, klavye odağı ve reduced motion.
- Alembic migration, tekrar çalıştırılabilir demo seed, güvenli admin CLI, Windows kurulum/başlatma script'leri, README, mimari belgesi, CI tanımı ve gerçek tarayıcı ekran görüntüleri.

## 2. Kullanılan teknolojiler

React 19, JavaScript/JSX, React Router 7, Vite 6, HTML5, normal CSS3; Python 3.12, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic, SQLite, Argon2id, HttpOnly cookie; npm, pip, venv, pytest, ESLint, Playwright.

Uygulama kaynaklarında TypeScript, Node.js backend, Tailwind, Supabase, Firebase veya harici auth/veritabanı yoktur. API anahtarı ve bulut hesabı gerekmiyor.

## 3. Proje klasörleri

`stockpilot/backend/app/{api,core,db,dependencies,models,schemas,services}`, `backend/alembic/versions`, `backend/scripts`, `backend/tests`, `backend/data`, `backend/uploads`; `frontend/src/{components,pages,layouts,contexts,hooks,services,styles,utils}`, `frontend/public`, `frontend/tests`; `docs/screenshots`, `.github/workflows`.

## 4. Veritabanı tabloları

`users`, `sessions`, `categories`, `products`, `suppliers`, `customers`, `stock_movements`, `orders`, `order_items`, `audit_logs`, `order_events`, `login_attempts`, `settings`.

Yerel uygulama veritabanı `backend/data/stockpilot.db` oluşturuldu ve migration uygulandı. Gerçek kullanıcı hesabı/parola eklenmedi. Demo ve test verileri yalnızca izole test veritabanlarında kullanıldı. Para integer kuruş, SQLite WAL + foreign key + 15 saniye busy timeout, yazmalarda `BEGIN IMMEDIATE` kullanılıyor.

## 5. API endpoint'leri

`/api/auth/*`, `/api/products/*`, `/api/categories/*`, `/api/inventory`, `/api/orders/*`, `/api/customers/*`, `/api/suppliers/*`, `/api/dashboard/summary`, `/api/reports/{sales,export}`, `/api/users/*`, `/api/settings`, `/api/audit-logs`, `/api/health`.

Metot/yol matrisi [README API bölümünde](../README.md#api); uygulama başladığında ayrıntılı Pydantic şemaları `/docs` altında. Temel HTTP akışları otomatik testlerde gerçek FastAPI ile çalıştırıldı.

## 6. Test sonuçları

| Kontrol | Sonuç |
| --- | --- |
| pytest | **32 passed**, 7,84 saniye |
| ESLint | **Başarılı**, hata/uyarı yok |
| Alembic `upgrade head` | **Başarılı**, yerel veritabanı ve ayrı E2E veritabanı |
| Alembic `check` | **No new upgrade operations detected** |
| PowerShell script syntax parse | `setup.ps1` ve `start.ps1` **başarılı** |
| Git ignore | `.db`, `.env`, uploads, venv ve node_modules **hariç tutuluyor** |
| Uygulama kaynaklarında `.ts/.tsx` | **Yok** |

pytest senaryoları: doğru/hatalı login, rate limit, CSRF/Origin, session expiry/logout, kayıt onayı/kapalı kayıt, profil/parola, admin/employee izinleri, kayıt sahipliği, Secure cookie; ürün create/update/arşiv ve SKU; stok giriş/çıkış/düzeltme/negatif engel; sipariş toplamları/durumları/düzenleme/idempotency; eşzamanlı aynı/farklı sipariş onayı ve tekrarlı iptal; atomiklik/constraint; snapshot; satış/CSV/filtreler; görsel doğrulaması; seed tekrarı.

Bir bağımlılık uyarısı mevcut: Starlette TestClient, HTTPX kullanımını gelecekte kaldıracağını belirtiyor. Bu bir test hatası değil; 32 test geçti. İleride bağımlılık yükseltirken test istemcisi uyumluluğu gözden geçirilmeli.

Playwright/Chromium doğrulamaları **başarılı**:

1. Korumalı route, hatalı parola, başarılı login, gerçek veri dashboard.
2. Ürün oluşturma, zorunlu alanlar, sayfalama ve stok girişi.
3. Sipariş oluşturma, doğru kuruş toplamı, onay, iptal ve stok bakiyesinin geri gelmesi.
4. Tüm ana modül rotaları, 1440 px masaüstü taşma kontrolü, CSV indirme.
5. Koyu tema, 390 px mobil ana rotalar, menü, modal boyutları ve Escape ile kapatma.
6. Çıkış; **tarayıcı runtime hatası yok**.

Tarayıcı testi gerçek build + FastAPI + migration uygulanmış geçici SQLite kullandı. Rastgele test parolası üretildi. Test sunucusu test bitiminde kapatılır; sürekli dev server bırakılmaz.

## 7. Frontend build sonucu

`npm run build` **başarılı**. Vite 6.4.5, 1615 modül. Üretilen JS yaklaşık **353,67 kB** / gzip **107,11 kB**, CSS **37,38 kB** / gzip **8,31 kB**. Build `frontend/dist/` altında yerel olarak mevcut, Git'e dahil edilmez.

Ekran görüntüleri: [masaüstü](screenshots/dashboard-desktop.png), [koyu tema](screenshots/dashboard-dark.png), [mobil](screenshots/dashboard-mobile.png). Masaüstü ilk demo durumunu; koyu/mobil ekranlar test sırasında eklenen ürün/sipariş dahil durumu gösterir.

## 8. PowerShell ile çalıştırma

Bağımlılıklar bu çalışma alanında kurulu; ilk hesabınızı oluşturun, isterseniz demo verisini ekleyin:

```powershell
cd "C:\Users\PC\Documents\ChatGPT\Stok Siparis Sistemi\stockpilot"
cd backend
..\.venv\Scripts\python.exe -m scripts.create_admin
..\.venv\Scripts\python.exe -m scripts.seed
cd ..
.\start.ps1
```

Yeni bilgisayarda tüm kurulum için `stockpilot` içinden `setup.ps1 -Demo`, ardından `start.ps1` kullanın. Demo istemiyorsanız seed komutunu / `-Demo` seçeneğini atlayın. Başlatma sonrası yerel adres `http://127.0.0.1:8000`; Swagger `/docs`. Durdurma `Ctrl+C`.

## 9. Yönetici hesabı yöntemi

`python -m scripts.create_admin` ad/e-posta ister, parolayı ekranda göstermeden iki kez alır ve yalnızca Argon2 hash'ini kaydeder. Sabit/demo admin şifresi yoktur. Başkasının sizin için bildiği bir parola oluşturulmadı; kendi parolanızı yerel terminalde belirlemeniz gerekiyor.

## 10. Eksik veya doğrulanmamış işlemler

- Gerçek ilk yönetici hesabı kullanıcı tarafından oluşturulmalı. Asıl veritabanına demo yükleme bu adımdan sonra, isteğe bağlıdır.
- `setup.ps1` / `start.ps1` sözdizimleri doğrulandı; bütün etkileşimli ilk kurulum script'i kullanıcı parolası girişiyle baştan sona çalıştırılmadı. İçlerindeki pip/npm, migration, build ve Uvicorn/React bağlantısı ayrı adımlarda doğrulandı.
- İnternete deploy, uzak CI çalıştırma ve HTTPS proxy kurulumu yapılmadı. GitHub deposu `emrekilincc/StockPilot` adresine pushlandı; çalışan bir genel site adresi yoktur.
- Safari/Firefox, gerçek telefon donanımı, yük testi ve profesyonel penetrasyon testi yapılmadı. Mobil QA, Chromium viewport üzerinden yapıldı.
- SQLite tek yazıcılı yerel işletme hedefiyle tasarlandı; çok kiracılı bulut hizmeti veya yüksek eşzamanlı yazma kapasitesi iddiası yoktur.
