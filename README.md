# 🏠 Наш дом

Telegram Mini App для совместного учёта продуктов и бытовых вещей.

## Что уже есть

- продукты и бытовые товары;
- категории: бумажные товары, гигиена, бытовая химия, уборка и т. д.;
- количество и единицы;
- минимальный остаток;
- срок годности;
- общий список покупок;
- кнопки +/-;
- общий дом для двух людей;
- Telegram Mini App;
- Supabase как база.

## Переменные Render

Создай Web Service и добавь:

- `TELEGRAM_BOT_TOKEN` — токен из BotFather
- `SUPABASE_URL` — URL проекта Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — service role key из Supabase
- `BASE_URL` — публичный URL Render, например `https://our-home.onrender.com`
- `WEBHOOK_SECRET` — любая длинная случайная строка

Build command:
`pip install -r requirements.txt`

Start command:
`gunicorn app:app`

## Важно

Никогда не загружай Telegram-токен или Supabase service role key в GitHub. Они должны быть только в Environment Variables Render.

## Следующий этап

Добавить полноценную систему приглашения второго человека, автоматические уведомления о минимальном остатке/сроке годности и настройки времени напоминаний.
