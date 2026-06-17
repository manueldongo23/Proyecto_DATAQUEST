<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\DominioAprendizaje;
use App\Services\NameValidationService;
use App\Services\ActivityRecorder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private NameValidationService $nameValidationService,
        private ActivityRecorder $activityRecorder
    ) {}

    /**
     * User registration with initial learning domains
     */
    public function register(Request $request)
    {
        $request->validate([
            'correo' => 'required|email|unique:users',
            'apodo' => 'required|string|max:50|unique:users',
            'password' => 'required|string|min:8|max:255|confirmed',
        ]);

        // Validate apodo against blocked terms
        $validation = $this->nameValidationService->validate($request->apodo);
        if (!$validation['valid']) {
            return response()->json([
                'success' => false,
                'message' => $validation['errors'][0],
            ], 422);
        }

        $user = User::create([
            'correo' => $request->correo,
            'apodo' => $request->apodo,
            'password_hash' => Hash::make($request->password),
            'role' => 'usuario',
            'xp' => 0,
            'rango' => 'Aprendiz',
            'activo' => true,
        ]);

        // Initialize learning domains
        $conceptos = ['DF', '1FN', '2FN', '3FN', 'BCNF'];
        foreach ($conceptos as $concepto) {
            DominioAprendizaje::create([
                'user_id' => $user->id,
                'concepto' => $concepto,
                'porcentaje' => 0
            ]);
        }

        $isApiRequest = $request->wantsJson();

        if ($isApiRequest) {
            $token = $user->createToken('access_token')->plainTextToken;
        } else {
            Auth::guard('web')->login($user);
            $request->session()->regenerate();
            $token = null;
        }

        return response()->json([
            'success' => true,
            'message' => 'Usuario registrado correctamente',
            'access_token' => $token,
            'user' => $user->load('dominiosAprendizaje')
        ], 201);
    }

    /**
     * User login with token generation and session auth
     */
    public function login(Request $request)
    {
        $request->validate([
            'correo' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('correo', $request->correo)->first();

        if (!$user || !Hash::check($request->password, $user->password_hash)) {
            throw ValidationException::withMessages([
                'correo' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        if (!$user->activo) {
            return response()->json([
                'success' => false,
                'message' => 'Cuenta deshabilitada'
            ], 403);
        }

        $isApiRequest = $request->wantsJson();

        if ($isApiRequest) {
            $token = $user->createToken('access_token')->plainTextToken;
        } else {
            Auth::guard('web')->login($user);
            $request->session()->regenerate();
            $token = null;
        }

        return response()->json([
            'success' => true,
            'message' => 'Sesión iniciada correctamente',
            'access_token' => $token,
            'user' => $user->load('dominiosAprendizaje')
        ]);
    }

    /**
     * User logout - revoke current token and clear session
     */
    public function logout(Request $request)
    {
        $user = $request->user();

        if ($user) {
            try {
                $token = $user->currentAccessToken();
                if ($token && method_exists($token, 'delete')) {
                    $token->delete();
                }
            } catch (\Exception $e) {
                // Session-authenticated request without a token
            }
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada correctamente'
        ]);
    }

    /**
     * Get current authenticated user
     */
    public function me(Request $request)
    {
        $user = $request->user()->load(['dominiosAprendizaje', 'logros']);

        return response()->json([
            'success' => true,
            'user' => $user
        ]);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'apodo' => 'sometimes|string|max:50|unique:users,apodo,' . $user->id,
        ]);

        if ($request->has('apodo')) {
            $validation = $this->nameValidationService->validate($request->apodo);
            if (!$validation['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => $validation['errors'][0],
                ], 422);
            }
            $user->apodo = $request->apodo;
        }

        $user->save();

        $this->activityRecorder->record($user->id, 'perfil', 'Perfil actualizado desde Ajustes.');

        return response()->json([
            'success' => true,
            'message' => 'Perfil actualizado correctamente',
            'user' => $user->fresh()->load('dominiosAprendizaje')
        ]);
    }
}
