export const CLIENT_ERROR_EVENT = "groundx:client-error";

export type ClientErrorDetail = {
  context: string;
  message: string;
};

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown client error";
};

export const reportClientError = (error: unknown, context: string): void => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ClientErrorDetail>(CLIENT_ERROR_EVENT, {
      detail: {
        context,
        message: messageFromError(error),
      },
    })
  );
};
