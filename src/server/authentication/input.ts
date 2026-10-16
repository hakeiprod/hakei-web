import { z } from "zod";

export const emailSchema = z
  .string()
  .refine(
    (value) => !/[\r\n]/u.test(value),
    "メールアドレスの形式を確認してください",
  )
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email());

export const passwordSchema = z
  .string()
  .refine(
    (value) => !/[\uD800-\uDFFF]/u.test(value),
    "パスワードの文字を確認してください",
  )
  .refine((value) => {
    const length = [...value].length;
    return length >= 15 && length <= 128;
  }, "パスワードは15〜128文字で入力してください");

export const credentialsSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});
