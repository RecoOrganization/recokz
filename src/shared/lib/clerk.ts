import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export const useClerkSignUp = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signUp: clerkSignUp, isLoaded } = useSignUp();
  const { setActive } = useClerk();
  const router = useRouter();

  const signUp = async (email: string, password: string) => {
    if (!isLoaded) return;

    setIsLoading(true);

    try {
      await clerkSignUp.create({
        emailAddress: email,
        password: password,
      });
      await clerkSignUp.prepareEmailAddressVerification();

      toast.success("Спасибо за регистрацию!", {
        description:
          "Проверьте свою электронную почту на наличие ссылки для подтверждения.",
      });
    } catch (error) {
      toast.error("Не удалось зарегистрироваться", {
        description: "Попробуйте ещё раз",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const verify = async (code: string) => {
    if (!isLoaded) return;

    setIsLoading(true);

    try {
      const result = await clerkSignUp.attemptVerification({
        code: code,
        strategy: "email_code",
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        await fetch("/api/sync-user", { method: "POST", credentials: "include" });
        router.push("/onboarding");
      }
    } catch (error) {
      toast.error("Не удалось подтвердить почту", {
        description: "Попробуйте ещё раз",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return { signUp, verify, isLoaded, isLoading };
};

export const useClerkSignIn = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn: clerkSignIn, isLoaded } = useSignIn();
  const { setActive } = useClerk();
  const router = useRouter();

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const result = await clerkSignIn?.create({
        identifier: email,
        password,
      });
      if (result?.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/cabinet");
      }
    } catch (error) {
      toast.error("Ошибка при входе", {
        description:
          "Проверьте правильность введённых данных и попробуйте ещё раз",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return { signIn, isLoaded, isLoading };
};
