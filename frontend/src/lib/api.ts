import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// add JWT token if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// types
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  username: string;
  email: string;
  displayName: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  characterCount: number;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  title: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
}

// Auth API
export const authApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post("/auth/register", data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post("/auth/login", data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post("/auth/logout");
  },
};

// Documents API
export const documentsApi = {
  getAll: async (): Promise<Document[]> => {
    const response = await api.get("/Document");
    return response.data;
  },

  getById: async (id: string): Promise<Document> => {
    const response = await api.get(`/Document/${id}`);
    return response.data;
  },

  create: async (data: CreateDocumentRequest): Promise<Document> => {
    const response = await api.post("/Document", data);
    return response.data;
  },

  update: async (
    id: string,
    data: UpdateDocumentRequest
  ): Promise<Document> => {
    const response = await api.put(`/Document/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/Document/${id}`);
  },
};

export default api;
