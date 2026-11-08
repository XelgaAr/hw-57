# Основания реализации

## Предоставленные материалы

Основные требования — `src/ASSIGNMENT.md`. Исходный контракт проверяется в `src/__test__/task1.test.js`. В приложенной лекции «57. Path. Events. Socketio. Http. Stream.pdf», страницы 23–26, рассматриваются встроенный HTTP-модуль, request/response и создание сервера. Остальные темы лекции не добавлены как отдельные задания, поскольку их нет в техническом задании.

## Официальная документация

Сверка API: 8 ноября 2026 года. Для runtime использованы стабильные встроенные API Node.js; для тестов выбрана поддерживаемая ветка Vitest 4.1, версия 4.1.12. Наличие версий и API сверялось по официальным сайтам; установка пакетов в среде проверки не была выполнена из-за недоступности npm registry.

- [Node.js HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html): сервер, ответы, таймауты и завершение соединений.
- [Node.js URL](https://nodejs.org/api/url.html): `URL.parse` и разбор пути запроса.
- [Node.js querystring](https://nodejs.org/api/querystring.html): парсинг form-urlencoded и повторяющиеся ключи.
- [Node.js Crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html): `createHash`, `pbkdf2Sync`, `randomBytes`, `timingSafeEqual`.
- [Node.js test runner](https://nodejs.org/api/test.html): дополнительные тесты без внешних зависимостей.
- [Web Crypto / PBKDF2](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits): браузерное вычисление ключа и размер в битах.
- [Vitest 4 environment](https://v4.vitest.dev/guide/environment): Node.js-окружение вместо ненужного jsdom.
- [Vitest 4 reporters](https://v4.vitest.dev/guide/reporters): вывод результатов тестов.
- [Vitest releases](https://github.com/vitest-dev/vitest/releases): проверенная версия 4.1.12.
- [Playwright BrowserType](https://playwright.dev/docs/api/class-browsertype): Chromium, скриншоты и тестовые браузерные сессии.
- [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages): публикация статического артефакта.

## Дополнения к заданию

Лимит 16 KiB, проверка MIME-типа и формата email, экранирование HTML, CSP, Referrer-Policy и демонстрация Pages добавлены сверх минимальных требований. Они не заменяют требуемые маршруты и тексты ответов. Парсер querystring выбран именно по заданию, хотя существуют другие API разбора форм.
