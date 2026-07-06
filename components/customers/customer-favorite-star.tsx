"use client";

interface CustomerFavoriteStarProps {
  isFavorite: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function CustomerFavoriteStar({
  isFavorite,
  disabled = false,
  onToggle,
}: CustomerFavoriteStarProps) {
  return (
    <button
      type="button"
      aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`shrink-0 text-lg leading-none transition disabled:opacity-40 ${
        isFavorite ? "text-amber-400 hover:text-amber-500" : "text-zinc-300 hover:text-amber-300"
      }`}
    >
      {isFavorite ? "★" : "☆"}
    </button>
  );
}
