export const BOT_PYTHON_CODE = `# ==============================================================================
# Telegram Bot на базе aiogram 3.x для запуска SIM Gacha Mini App
# Файл: bot.py
# Запуск: python bot.py
# ==============================================================================

import asyncio
import logging
import os
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    Message,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    MenuButtonWebApp
)
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties

# Токен бота от @BotFather (или задайте через переменную окружения BOT_TOKEN)
BOT_TOKEN = os.getenv("BOT_TOKEN", "8748940272:AAFze_ClMme6PfumQeOad0rIfac-HxNjKWM")

# URL вашего развернутого Mini App (например, на Vercel, Cloud Run или ngrok)
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://rettreterreeer.vercel.app/")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(
    token=BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)
dp = Dispatcher()


def get_main_keyboard() -> InlineKeyboardMarkup:
    """Генерирует инлайн-кнопку WebAppInfo для открытия игры"""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎰 Открыть SIM Gacha",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )
            ],
            [
                InlineKeyboardButton(
                    text="🏆 Моя коллекция",
                    web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=collection")
                ),
                InlineKeyboardButton(
                    text="⚡ Магазин удачи",
                    web_app=WebAppInfo(url=f"{WEBAPP_URL}?tab=shop")
                )
            ],
            [
                InlineKeyboardButton(
                    text="💬 Чат игроков",
                    url="https://t.me/telegram"
                )
            ]
        ]
    )


@dp.message(CommandStart())
async def cmd_start(message: Message):
    """Приветственное сообщение с запуском Mini App"""
    user_name = message.from_user.first_name if message.from_user else "Игрок"
    
    welcome_text = (
        f"👋 <b>Привет, {user_name}! Добро пожаловать в SIM Gacha!</b>\\n\\n"
        f"📱 <b>SIM Gacha</b> — это захватывающий симулятор открытия и оценки "
        f"телефонных номеров формата <code>+7 (9XX) XXX-XX-XX</code>.\\n\\n"
        f"✨ <b>Что тебя ждёт:</b>\\n"
        f"• Стартовый капитал: <b>50 000 ₽</b>\\n"
        f"• Редкости: от обычных до <b>Бриллиантовых VIP (x500)</b>\\n"
        f"• Палиндромы, зеркала, лесенки <code>123-45-67</code> и три топора <code>777</code>\\n"
        f"• Прокачка показателей Удачи и Кэшбэка\\n"
        f"• Личная коллекция красивых SIM-карт\\n\\n"
        f"👇 <i>Нажми кнопку ниже, чтобы начать крутить барабан:</i>"
    )
    
    # Настраиваем постоянную кнопку Mini App в меню ввода Telegram
    try:
        await bot.set_chat_menu_button(
            chat_id=message.chat.id,
            menu_button=MenuButtonWebApp(
                text="📱 Играть",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        )
    except Exception as e:
        logger.warning(f"Не удалось установить MenuButton: {e}")

    await message.answer(
        text=welcome_text,
        reply_markup=get_main_keyboard()
    )


@dp.message(Command("help"))
async def cmd_help(message: Message):
    help_text = (
        "📖 <b>Правила игры и шансы выпадения:</b>\\n\\n"
        "⚪ <b>Обычный (Common)</b> — ~70% (множитель x0.1–x0.3)\\n"
        "🟠 <b>Бронзовый (Uncommon)</b> — ~18% (множитель x0.5–x1)\\n"
        "🔵 <b>Серебряный (Rare)</b> — ~8% (множитель x2–x5)\\n"
        "🟡 <b>Золотой (Epic)</b> — ~3.5% (множитель x10–x25)\\n"
        "🟣 <b>Бриллиантовый VIP</b> — ~0.5% (множитель x50–x500)\\n\\n"
        "💡 <i>Прокачивайте уровень Удачи в магазине, чтобы повысить шансы на VIP-номера!</i>"
    )
    await message.answer(help_text, reply_markup=get_main_keyboard())


async def main():
    logger.info("Запуск Telegram-бота SIM Gacha...")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот остановлен.")
`;

export const FASTAPI_BACKEND_CODE = `# ==============================================================================
# FastAPI Backend для синхронизации данных игроков SIM Gacha
# Файл: server.py
# Запуск: uvicorn server:app --host 0.0.0.0 --port 8000 --reload
# ==============================================================================

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import hmac
import hashlib
import json
import time
import os

app = FastAPI(title="SIM Gacha API", version="1.0.0")

# CORS для вызова из Telegram WebApp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BOT_TOKEN = os.getenv("BOT_TOKEN", "123456789:ABCDefGhIJKlmNoPQRstuVWXyz")

# In-Memory хранилище (в продакшене используйте PostgreSQL / Redis)
players_db: Dict[int, Dict[str, Any]] = {}


class PhoneNumberCardModel(BaseModel):
    id: str
    fullNumber: str
    tailFormatted: str
    rawTail: str
    operatorCode: str
    operatorName: str
    rarity: str
    multiplier: float
    sellPrice: int
    spinCost: int
    tags: List[str]
    createdAt: int
    isFavorite: Optional[bool] = False


class SyncUserDataModel(BaseModel):
    userId: int
    username: Optional[str] = None
    balance: int
    luckLevel: int = 0
    discountLevel: int = 0
    cashbackLevel: int = 0
    totalSpins: int = 0
    collection: List[PhoneNumberCardModel] = []


def verify_telegram_init_data(init_data_raw: str) -> bool:
    """Валидация подписи initData от Telegram WebApp"""
    if not init_data_raw or not BOT_TOKEN:
        return True  # Для локальной разработки без валидации
    try:
        vals = dict(x.split("=", 1) for x in init_data_raw.split("&") if "=" in x)
        received_hash = vals.pop("hash", None)
        if not received_hash:
            return False
        data_check_string = "\\n".join(f"{k}={v}" for k, v in sorted(vals.items()))
        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calc_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        return calc_hash == received_hash
    except Exception:
        return False


@app.get("/")
def health_check():
    return {"status": "ok", "service": "SIM Gacha Backend"}


@app.get("/api/user/{user_id}")
def get_user_profile(user_id: int):
    """Получить сохраненное состояние игрока"""
    if user_id not in players_db:
        # Новый профиль с дефолтными 50 000 рублями
        players_db[user_id] = {
            "userId": user_id,
            "balance": 50000,
            "luckLevel": 0,
            "discountLevel": 0,
            "cashbackLevel": 0,
            "totalSpins": 0,
            "collection": [],
            "updatedAt": int(time.time()),
        }
    return players_db[user_id]


@app.post("/api/user/sync")
def sync_user_data(payload: SyncUserDataModel):
    """Синхронизация прогресса (баланс, инвентарь, прокачка)"""
    user_id = payload.userId
    players_db[user_id] = {
        "userId": user_id,
        "username": payload.username,
        "balance": payload.balance,
        "luckLevel": payload.luckLevel,
        "discountLevel": payload.discountLevel,
        "cashbackLevel": payload.cashbackLevel,
        "totalSpins": payload.totalSpins,
        "collection": [c.dict() for c in payload.collection],
        "updatedAt": int(time.time()),
    }
    return {"status": "synced", "balance": payload.balance, "inventoryCount": len(payload.collection)}
`;

export const REQUIREMENTS_TXT = `aiogram>=3.4.1
fastapi>=0.110.0
uvicorn>=0.29.0
pydantic>=2.6.4
python-dotenv>=1.0.1
`;
