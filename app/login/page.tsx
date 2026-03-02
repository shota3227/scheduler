"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
    const handleMicrosoftLogin = () => {
        signIn("microsoft-entra-id", { callbackUrl: "/dashboard" });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                {/* ロゴ・タイトル */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">日程調整システム</h1>
                    <p className="text-gray-500 text-sm mt-1">社内メンバー向けログイン</p>
                </div>

                {/* Microsoft 365 SSOボタン */}
                <button
                    id="microsoft-sso-btn"
                    onClick={handleMicrosoftLogin}
                    className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                    <svg className="w-5 h-5" viewBox="0 0 21 21">
                        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Microsoft 365 でログイン
                </button>
            </div>
        </div>
    );
}
