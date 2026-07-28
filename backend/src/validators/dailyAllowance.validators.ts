import { z } from "zod";

export const submitDailyAllowanceSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  remark: z.string().optional()
});
