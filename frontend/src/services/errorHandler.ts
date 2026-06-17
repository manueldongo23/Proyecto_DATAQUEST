interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export function handleApiError(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as any).response;
    const data = response?.data as ApiError | undefined;
    
    if (data?.message) {
      return data.message;
    }
    
    if (data?.errors) {
      const messages = Object.values(data.errors).flat();
      return messages.join('. ');
    }

    if (response?.status === 401) return 'Sesión expirada. Inicia sesión nuevamente.';
    if (response?.status === 403) return 'No tienes permiso para esta acción.';
    if (response?.status === 404) return 'Recurso no encontrado.';
    if (response?.status === 429) return 'Demasiadas solicitudes. Intenta de nuevo más tarde.';
    if (response?.status >= 500) return 'Error del servidor. Intenta de nuevo.';
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return (error as any).message;
  }

  return 'Error de conexión. Verifica tu red.';
}
