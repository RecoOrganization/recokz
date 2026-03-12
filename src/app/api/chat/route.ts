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
2. Для получения суммы транзакций используй 'get_daily_transaction_sum'. Фильтровать можно по названию компании (достаточно части названия) — передавай параметр company_name. Без параметра вернётся сумма по всем организациям.
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
        description:
          'Получить общую сумму транзакций за текущие сутки. Можно передать название компании (или часть названия) для фильтрации по организации.',
        parameters: z.object({
          company_name: z
            .string()
            .optional()
            .describe(
              'Название компании для фильтрации (достаточно части названия, без учёта регистра)',
            ),
        }),
        execute: async ({ company_name }) => {
          try {
            let organizationId: string | null = null;

            if (company_name?.trim()) {
              const nameRows = await pool.query(
                `SELECT id FROM organizations WHERE name ILIKE $1 LIMIT 1`,
                [`%${company_name.trim()}%`],
              );
              if (nameRows.rows.length === 0) {
                return {
                  error: `Организация по названию «${company_name}» не найдена`,
                  period: 'сегодня',
                };
              }
              organizationId = nameRows.rows[0].id;
            }

            let query = `
              SELECT 
                SUM(amount) as total_sum, 
                COUNT(*) as total_count 
              FROM transactions 
              WHERE created_at >= CURRENT_DATE
            `;
            const params: string[] = [];

            if (organizationId) {
              query += ` AND organization_id = $1`;
              params.push(organizationId);
            }

            const { rows } =
              params.length > 0
                ? await pool.query(query, params)
                : await pool.query(query);

            return {
              sum: rows[0]?.total_sum ?? 0,
              count: rows[0]?.total_count ?? 0,
              period: 'сегодня',
              ...(organizationId && { filtered_by_organization: true }),
            };
          } catch (error) {
            console.error('DB Error:', error);
            return { error: 'Не удалось получить данные из базы' };
          }
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}