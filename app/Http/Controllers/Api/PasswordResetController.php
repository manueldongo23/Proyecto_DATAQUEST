<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    public function forgotPassword(Request $request)
    {
        $request->validate(['correo' => 'required|email']);

        $user = User::where('correo', $request->correo)->first();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Si el correo existe, recibirás un enlace de recuperación'
            ]);
        }

        $token = Str::random(60);
        cache()->put('password_reset_' . $token, $user->id, 3600);

        Log::info('Password reset token generated', [
            'correo' => $user->correo,
            'token_preview' => substr($token, 0, 8) . '...'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Si el correo existe, recibirás un enlace de recuperación'
        ]);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:8|max:255|confirmed',
        ]);

        $userId = cache()->pull('password_reset_' . $request->token);
        if (!$userId) {
            return response()->json([
                'success' => false,
                'message' => 'Token inválido o expirado'
            ], 400);
        }

        $user = User::find($userId);
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        $user->password_hash = Hash::make($request->password);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Contraseña actualizada correctamente'
        ]);
    }
}
