Первый публичный выпуск: голосовой ввод на русском для DeepSeek Harness через локальный Whisper.

**Установка**

Каталог плагинов: Plugins → Discover → Add index → `https://shtazi98.github.io/echorus-voice/index.json`

Без каталога: Plugins → Add plugin → `github:Shtazi98/echorus-voice` (нужен git).

**Что умеет**

- Локальное распознавание на CPU, без облака и API-ключей. Аудио удаляется сразу после расшифровки.
- Сам находит Python 3.9+, ставит `faster-whisper` в каталог данных и скачивает модель при первом запуске.
- Модели на выбор: `small`, `medium`, `large-v3-turbo` (по умолчанию), `large-v3`.
- Контекстная подсказка про деловую диктовку: пунктуация и заглавные буквы.
- `glossary` — термины, которые модель должна услышать; `replacements` — словарь подстановок латиницей.

**Известные ограничения**

- Только CPU; модель загружается на каждый запрос, это добавляет 3–4 секунды.
- Первая установка — около 2 ГБ трафика и несколько минут.
- Совместимость: DSH 0.2.3.

Русский в приоритете, но провайдер принимает любые языковые подсказки Whisper.

---

First public release: local Whisper voice input for DeepSeek Harness, Russian first.

Install through the plugin index above, or `github:Shtazi98/echorus-voice`. CPU only, no cloud, no API keys.
