import { invoke } from "@tauri-apps/api/core";

export async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const raw: string = await invoke("graphql", {
    query,
    variables: variables ? JSON.stringify(variables) : null,
  });
  const response = JSON.parse(raw);
  if (response.errors?.length) {
    throw new Error(response.errors[0].message);
  }
  return response.data as T;
}
