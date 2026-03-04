import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { Pool } from 'pg';

// Настройка подключения к PostgreSQL
// Рекомендуется вынести создание Pool в отдельный файл lib/db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // e.g., postgresql://user:password@localhost:5432/db
});

const SYSTEM_PROMPT = `
Ты — AI-ассистент Reco. 
Твоя задача — помогать клиентам с данными из PostgreSQL и управлением POS-терминалами.

ПРАВИЛА:
1. Если запрос непонятен — вызови инструмент 'get_capabilities' или задай уточняющий вопрос.
2. Для получения суммы транзакций используй 'get_daily_transaction_sum'.
3. Всегда отвечай вежливо и только на основе данных из инструментов.
`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    messages,
    system: SYSTEM_PROMPT,
    maxSteps: 5, 
    tools: {
      get_capabilities: tool({
        description: 'Показать список всех доступных действий ИИ-ассистента',
        parameters: z.object({}),
        execute: async () => ({
          actions: [
            "Расчет выручки за сегодня (общая или по конкретной компании)",
            "Поиск компаний в базе данных",
            "Регистрация POS-терминалов через удаленный прокси"
          ]
        }),
      }),

      get_daily_transaction_sum: tool({
        description: 'Получить общую сумму транзакций за текущие сутки',
        parameters: z.object({
          company_id: z.string().optional().describe('ID компании для фильтрации'),
        }),
        execute: async ({ company_id }) => {
          try {
            // Используем параметризованный запрос для безопасности
            let query = `
              SELECT 
                SUM(amount) as total_sum, 
                COUNT(*) as total_count 
              FROM transactions 
              WHERE created_at >= CURRENT_DATE
            `;
            const params: any[] = [];

            if (company_id) {
              query += ` AND company_id = $1`;
              params.push(company_id);
            }

            const { rows } = await pool.query(query, params);
            
            return {
              sum: rows[0].total_sum || 0,
              count: rows[0].total_count,
              period: "сегодня"
            };
          } catch (error) {
            console.error("DB Error:", error);
            return { error: "Не удалось получить данные из базы" };
          }
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}