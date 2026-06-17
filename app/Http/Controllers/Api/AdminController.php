<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\BlockedTerm;
use App\Models\Esquema;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function dashboard()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'total_users' => User::count(),
                'active_users' => User::where('activo', true)->count(),
                'total_schemas' => Esquema::count(),
                'total_blocked_terms' => BlockedTerm::count(),
                'recent_users' => User::latest()->take(5)->get(['id', 'correo', 'apodo', 'fecha_registro']),
            ]
        ]);
    }

    public function listUsers(Request $request)
    {
        $users = User::withCount('esquemas')
            ->orderBy('id', 'desc')
            ->paginate(20, ['id', 'correo', 'apodo', 'role', 'activo', 'xp', 'rango', 'fecha_registro']);

        return response()->json(['success' => true, 'data' => $users]);
    }

    public function toggleUser(int $id)
    {
        $user = User::findOrFail($id);
        $user->activo = !$user->activo;
        $user->save();

        return response()->json([
            'success' => true,
            'message' => $user->activo ? 'Usuario activado' : 'Usuario desactivado'
        ]);
    }

    public function listBlockedTerms()
    {
        $terms = BlockedTerm::orderBy('category')->get();
        return response()->json(['success' => true, 'data' => $terms]);
    }

    public function addBlockedTerm(Request $request)
    {
        $request->validate([
            'term' => 'required|string|max:100|unique:blocked_terms',
            'category' => 'required|string|max:50',
            'severity' => 'required|in:low,medium,high',
        ]);

        $term = BlockedTerm::create($request->only(['term', 'category', 'severity', 'description']));

        return response()->json([
            'success' => true,
            'message' => 'Término agregado',
            'data' => $term
        ], 201);
    }

    public function removeBlockedTerm(int $id)
    {
        $term = BlockedTerm::findOrFail($id);
        $term->delete();
        return response()->json(['success' => true, 'message' => 'Término eliminado']);
    }
}
