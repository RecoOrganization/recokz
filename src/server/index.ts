import { createTRPCRouter } from "@/shared/lib/trpc/server";
import { organizationRouter } from "./organization";
import { transactionTypeRouter } from "./transaction-type";
import { reportsRouter } from "./reports";
import { documentsRouter } from "./documents";
import { reconciliationRouter } from "./reconciliation";
import { webhookRouter } from "./webhook";
import { crmTransactionRouter } from "./crm-transaction";
import { rekassaRouter } from "./rekassa";
import { bankTransactionRouter } from "./bank-transaction";
import { transactionRouter } from "./transaction";
import { userRouter } from "./user";
import { dashboardRouter } from "./dashboard";

export const appRouter = createTRPCRouter({
  dashboard: dashboardRouter,
  organization: organizationRouter,
  transactionType: transactionTypeRouter,
  reports: reportsRouter,
  documents: documentsRouter,
  reconciliation: reconciliationRouter,
  webhook: webhookRouter,
  crmTransaction: crmTransactionRouter,
  rekassa: rekassaRouter,
  bankTransaction: bankTransactionRouter,
  transaction: transactionRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
