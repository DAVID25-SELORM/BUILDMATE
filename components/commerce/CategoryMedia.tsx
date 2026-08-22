import Image from "next/image";

type CategoryMediaProps = {
  imagePath: string | null;
  imageAlt: string | null;
  categoryName: string;
  sizes: string;
};

export function CategoryMedia({
  imagePath,
  imageAlt,
  categoryName,
  sizes,
}: CategoryMediaProps) {
  if (!imagePath) {
    return (
      <div
        className="flex h-full items-center justify-center bg-slate-100 px-4 text-center text-sm font-medium text-slate-500"
        role="img"
        aria-label={`${categoryName} image coming soon`}
      >
        Image coming soon
      </div>
    );
  }

  return (
    <Image
      src={imagePath}
      alt={imageAlt || `${categoryName} construction materials`}
      fill
      sizes={sizes}
      className="object-cover transition duration-300 group-hover:scale-105"
    />
  );
}
