"use client";
import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { api as axiosApi } from "@/shared/client";
import { LoaderIcon } from "@/shared/ui/loader";
import Image from "next/image";
import { api } from "@/shared/lib/trpc/client";
import { toast } from "sonner";

export const Main = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [rekassaData, setRekassaData] = useState({
    number: "",
    password: "",
  });
  const { user } = useUser();

  const { mutateAsync: saveCredentials, isPending: isSaving } =
    api.rekassa.saveCredentials.useMutation({
      onSuccess: () => {
        toast.success("Rekassa успешно подключена");
      },
      onError: () => {
        toast.error("Не удалось сохранить данные Rekassa");
      },
    });

  if (!user || isLoading) {
    return (
      <div className="p-6">
        <LoaderIcon className="animate-spin" />
      </div>
    );
  }

  const connectToRekassa = async () => {
    setIsLoading(true);
    try {
      const response = await axiosApi.post(
        `${process.env.NEXT_PUBLIC_API_REKASSA}/api/auth/login?apiKey=${process.env.NEXT_PUBLIC_API_KEY_REKASSA}&format=json`,
        rekassaData,
      );
      await saveCredentials({
        id: response.data.id.toString(),
        token: response.data.token,
        number: rekassaData.number,
        password: rekassaData.password,
      });
    } catch (e) {
      console.log(e);
    }

    setIsLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="mb-4 text-3xl">Страница подключения интеграций</h1>
      <div>
        <h3 className="mb-2 text-2xl">Rekassa</h3>
        <p>
          Для подключения Rekassa необходимо ввести ЗНМ и пароль кассы для
          интеграции.
        </p>
        <p>
          После подключения Rekassa можно будет использовать все функции
          Rekassa.
        </p>
        <div className="flex flex-col items-start space-y-4">
          <label className="flex flex-col w-full">
            Введите ЗНМ
            <input
              type="text"
              className="p-2 border border-2 border-gray rounded-xl"
              placeholder="M6Z4Q95L-BLZ"
              onChange={(e) =>
                setRekassaData((prev) => ({ ...prev, number: e.target.value }))
              }
            />
          </label>
          <label className="flex flex-col w-full">
            Введите Пароль кассы для интеграции
            <input
              type="text"
              className="p-2 border border-2 border-gray rounded-xl"
              placeholder="KqUV#oxSi*GvjiKyRi983HIp79GgAzWI"
              onChange={(e) =>
                setRekassaData((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
            />
          </label>
          <button
            type="button"
            className="p-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            onClick={connectToRekassa}
          >
            Подключить
          </button>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-2xl">МойСклад</h3>
        <p>Для подключения обратитесь к администратору 8-771-540-22-40.</p>
        <div className="flex flex-col items-start space-y-4"></div>
      </div>
      <div>
        <h3 className="mb-2 text-2xl">Altegio</h3>
        <p>Для подключения обратитесь к администратору 8-771-540-22-40.</p>
        <div className="flex flex-col items-start space-y-4"></div>
      </div>
    </div>
  );
};
