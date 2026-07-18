interface Props {
  suggestions: string[];
}

export default function SuggestionCard({ suggestions }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
      <h3 className="font-semibold text-blue-900 mb-3">💡 重点练习建议</h3>
      <ul className="space-y-2">
        {suggestions.map((s, i) => (
          <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">•</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
