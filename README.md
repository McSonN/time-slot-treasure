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

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
