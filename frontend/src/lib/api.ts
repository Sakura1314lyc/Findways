import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../stores/auth";
import type { TokenPair } from "./types";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const api = axios.create({ baseURL, timeout: 120000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    useAuthStore.getState().logout();
    return null;
  }
  try {
    const response = await axios.post<TokenPair>(`${baseURL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    const { access_token, refresh_token } = response.data;
    useAuthStore.getState().setTokens(access_token, refresh_token);
    return access_token;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const isTokenEndpoint = /\/auth\/(login|register|refresh|logout)(?:\?|$)/.test(original?.url ?? "");
    if (status === 401 && original && !original._retried && !isTokenEndpoint) {
      original._retried = true;
      refreshing = refreshing ?? refreshAccessToken();
      let token: string | null;
      try {
        token = await refreshing;
      } finally {
        refreshing = null;
      }
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api.request(original);
      }
    }
    return Promise.reject(error);
  },
);

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "无法连接服务，请检查网络或稍后重试";
    const detail = error.response?.data as
      | { error?: { message?: string }; detail?: { msg?: string }[] }
      | undefined;
    if (detail?.error?.message) return detail.error.message;
    if (Array.isArray(detail?.detail) && detail.detail.length > 0) {
      return detail.detail[0]?.msg ?? "请求参数有误";
    }
    return error.message;
  }
  return "请求失败，请稍后再试";
}
