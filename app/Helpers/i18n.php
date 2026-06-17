<?php

if (!function_exists('__')) {
    function __(string $key, array $replace = [], ?string $locale = null): string
    {
        $locale = $locale ?? app()->getLocale();
        $translations = [
            'es' => [
                'validation.required' => 'Este campo es requerido',
                'validation.email' => 'El formato del correo no es válido',
                'validation.min' => 'El mínimo de caracteres es :min',
                'validation.max' => 'El máximo de caracteres es :max',
                'validation.unique' => 'Este valor ya está registrado',
                'validation.confirmed' => 'Las contraseñas no coinciden',
                'auth.failed' => 'Credenciales incorrectas',
                'auth.blocked' => 'Cuenta deshabilitada',
                'name.blocked' => 'Este apodo contiene términos no permitidos',
                'schema.invalid' => 'El esquema contiene datos inválidos',
                'schema.large' => 'El esquema es demasiado grande',
                'server.error' => 'Error interno del servidor',
                'not_found' => 'Recurso no encontrado',
                'success.created' => 'Creado correctamente',
                'success.updated' => 'Actualizado correctamente',
                'success.deleted' => 'Eliminado correctamente',
            ],
            'en' => [
                'validation.required' => 'This field is required',
                'validation.email' => 'Invalid email format',
                'validation.min' => 'Minimum :min characters required',
                'validation.max' => 'Maximum :max characters allowed',
                'validation.unique' => 'This value is already taken',
                'validation.confirmed' => 'Passwords do not match',
                'auth.failed' => 'Invalid credentials',
                'auth.blocked' => 'Account disabled',
                'name.blocked' => 'This nickname contains blocked terms',
                'schema.invalid' => 'The schema contains invalid data',
                'schema.large' => 'The schema is too large',
                'server.error' => 'Internal server error',
                'not_found' => 'Resource not found',
                'success.created' => 'Created successfully',
                'success.updated' => 'Updated successfully',
                'success.deleted' => 'Deleted successfully',
            ],
            'pt_BR' => [
                'validation.required' => 'Este campo é obrigatório',
                'validation.email' => 'Formato de e-mail inválido',
                'validation.min' => 'Mínimo de :min caracteres',
                'validation.max' => 'Máximo de :max caracteres',
                'validation.unique' => 'Este valor já está registrado',
                'validation.confirmed' => 'Senhas não conferem',
                'auth.failed' => 'Credenciais inválidas',
                'auth.blocked' => 'Conta desabilitada',
                'name.blocked' => 'Este apelido contém termos bloqueados',
                'schema.invalid' => 'O esquema contém dados inválidos',
                'schema.large' => 'O esquema é muito grande',
                'server.error' => 'Erro interno do servidor',
                'not_found' => 'Recurso não encontrado',
                'success.created' => 'Criado com sucesso',
                'success.updated' => 'Atualizado com sucesso',
                'success.deleted' => 'Excluído com sucesso',
            ],
        ];

        $text = $translations[$locale][$key] ?? $translations['es'][$key] ?? $key;

        foreach ($replace as $k => $v) {
            $text = str_replace(":$k", $v, $text);
        }

        return $text;
    }
}
