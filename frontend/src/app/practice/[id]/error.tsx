"use client";

export default function PracticeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-red-500">练习页面出错：{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
        重试
      </button>
    </div>
  );
}
