<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\User;
use App\Models\UserAchievement;
use Illuminate\Http\Request;

class AchievementController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $achievements = Achievement::orderBy('xp_reward')->get();
        $userAchievementIds = UserAchievement::where('user_id', $user->id)
            ->pluck('achievement_id')
            ->toArray();

        $data = $achievements->map(function ($achievement) use ($userAchievementIds) {
            $unlocked = in_array($achievement->id, $userAchievementIds);

            return [
                'id' => $achievement->id,
                'name' => $achievement->name,
                'description' => $achievement->description,
                'icon' => $achievement->icon,
                'xp_reward' => $achievement->xp_reward,
                'criteria_type' => $achievement->criteria_type,
                'criteria_value' => $achievement->criteria_value,
                'unlocked' => $unlocked,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public function userAchievements(int $userId)
    {
        $user = User::findOrFail($userId);

        $achievements = UserAchievement::where('user_id', $user->id)
            ->with('achievement')
            ->orderBy('unlocked_at', 'desc')
            ->get();

        $data = $achievements->map(function ($ua) {
            return [
                'id' => $ua->achievement->id,
                'name' => $ua->achievement->name,
                'description' => $ua->achievement->description,
                'icon' => $ua->achievement->icon,
                'xp_reward' => $ua->achievement->xp_reward,
                'unlocked_at' => $ua->unlocked_at,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
