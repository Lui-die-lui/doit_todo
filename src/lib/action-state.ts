export type ActionState<TFieldKeys extends string = string> = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<TFieldKeys | "_form", string>>;
};

export const initialActionState: ActionState = { status: "idle" };
