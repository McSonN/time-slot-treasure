# Time Slot Treasure

Strona oparta o kalendarz, wyświetlająca dni i godziny. Jednocześnie wyświetla 1 tydzień, z możliwością przejścia do następnego tygodnia lub przeskoczenia do dowolnego tygodnia poprzez rozwinięcie kalendarzyka.

Użytkownik ma możliwość zaznaczenia dowolnych, następujących po sobie godzin w celu dokonania rezerwacji - przejścia do strony składania wniosku.

Na stronie kalendarza, użytkownik ma widzieć niedostępne godziny wynajmu poprzez wyszarzenie ich pól i niemożliwość zaznaczenia ich. Użytkownik nie widzi detali wniosków innych użytkowników ale ma możliwość wejścia w detale swojego wniosku z poziomu kalendarza, poprzez kliknięcie w pola zajęte przez jego wniosek.

Użytkownik ma dostęp do listy obiektów. Każdy obiekt ma swoją własną listę rezerwacji. Użytkownik widzi na kalendarzu dostępność wyłącznie dla wybranego przez siebie obiektu. Użytkownik ma możliwość rezerwacji bez wyboru obiektu, przez wybranie ilości uczestników wydarzenia. Kalendarz wtedy wyszarzy tylko pola, w których nie ma dostępności w żadnym z obiektów o odpowiedniej liczbie miejsc. 

Na poziomie dostępu administratora, zamiast wyszarzonych pól widać nazwę organizacji wynajmującej obiekt i przez kliknięcie w dane pole, można przejść do detali wniosku. Administrator posiada także możliwość wyświetlenia na kalendarzu jednocześnie wniosków i eventów we wszystkich administrowanych obiektach.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ffa59397-3e58-4cbe-8faa-015fd784f25f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

## Hosting poza Lovable: Cloudflare Workers + GitHub

GitHub Pages (w tym `https://mcsonn.github.io/time-slot-treasure/`) serwuje wyłącznie pliki statyczne. Nie uruchomi funkcji serwerowych tej aplikacji, dlatego samo włączenie Pages wyświetla README, a nie działający system rezerwacji. Przygotowana konfiguracja wdraża aplikację z GitHub na Cloudflare Workers; adres produkcyjny będzie inny niż adres GitHub Pages. Niezalogowany odwiedzający zobaczy logowanie na `/`, a po zalogowaniu kalendarz.

### Jednorazowa konfiguracja

1. Załóż konto Cloudflare i włącz Workers. Przygotuj API token ograniczony do edycji Workers w wybranym koncie (uprawnienia wymagane przez Wrangler), oraz Account ID.
2. W repozytorium GitHub otwórz **Settings → Secrets and variables → Actions**. Dodaj sekrety `CLOUDFLARE_API_TOKEN` i `CLOUDFLARE_ACCOUNT_ID`. Nie wpisuj tokena do kodu.
3. Dodaj publiczne zmienne repozytorium `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` z istniejącej konfiguracji aplikacji. To ustawienia publicznego klienta Lovable Cloud, nie klucz administratora; nie kopiuj żadnych prywatnych kluczy. Hosting używa nadal istniejących kont i danych w Lovable Cloud.
4. Jeżeli GitHub wymaga tego przy pierwszym uruchomieniu, włącz Actions. Workflow **Deploy application to Cloudflare** działa po zmianach na `main` albo ręcznie przez **Actions → Run workflow**. Inna gałąź domyślna wymaga zmiany `branches` w workflow.
5. Po udanym wdrożeniu otwórz adres Workers pokazany przez Cloudflare lub w wyniku Actions. Dodaj ten adres do dozwolonych adresów powrotu logowania w ustawieniach auth Lovable Cloud; sprawdź też adres strony używany w wiadomościach potwierdzających konto.
6. Sprawdź logowanie, złożenie wniosku i odczyt jego historii na nowym adresie. Zastąp link GitHub Pages linkiem Workers w miejscach, gdzie udostępniasz aplikację.

Nie trzeba publikować aplikacji na Lovable ani przekierowywać do Lovable. Nie można przypisać domeny `github.io` do Cloudflare, ponieważ należy do GitHub. Opcjonalnie podłącz własną domenę w Cloudflare.

Wdrożenie nie zostało wykonane przez autora zmian: wymaga konfiguracji Twojego konta Cloudflare i GitHub. Powiadomienia mailowe nadal czekają na konfigurację domeny nadawcy; sekrety Lovable nie są automatycznie kopiowane na zewnętrzny hosting.

## Uruchamianie lokalne

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
