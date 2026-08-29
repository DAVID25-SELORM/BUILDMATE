"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  deleteProductImage,
  recordProductImage,
  setProductCover,
  type MediaState,
} from "@/app/supplier/products/media-actions";
import { createClient } from "@/lib/supabase/client";

export type ListingMedia = {
  id: string;
  productName: string;
  variantName: string;
  branchName: string;
  media: { id: string; url: string; altText: string; isCover: boolean }[];
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function ProductMediaManager({
  listings,
  organisationId,
}: {
  listings: ListingMedia[];
  organisationId: string;
}) {
  const router = useRouter();
  const [uploadingListing, setUploadingListing] = useState<string | null>(null);
  const [state, setState] = useState<MediaState>({ message: "" });

  async function handleUpload(
    event: FormEvent<HTMLFormElement>,
    listing: ListingMedia,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const altText = String(formData.get("altText") ?? "").trim();
    const file = formData.get("image");
    if (!(file instanceof File) || !file.size) {
      setState({ message: "Choose a product image." });
      return;
    }
    if (!imageTypes.has(file.type)) {
      setState({ message: "Use a JPG, PNG or WebP image." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setState({ message: "Product images must be 5 MB or smaller." });
      return;
    }
    if (altText.length < 5 || altText.length > 240) {
      setState({ message: "Describe the image in 5–240 characters." });
      return;
    }

    setUploadingListing(listing.id);
    setState({ message: "" });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    const storagePath = `${organisationId}/${listing.id}/${crypto.randomUUID()}-${safeName}`;
    const supabase = createClient();

    try {
      const { error: uploadError } = await supabase.storage
        .from("product-media")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) {
        setState({ message: uploadError.message });
        return;
      }

      const result = await recordProductImage(listing.id, {
        storagePath,
        altText,
      });
      if (!result.ok) {
        await supabase.storage.from("product-media").remove([storagePath]);
        setState(result);
        return;
      }

      form.reset();
      setState(result);
      router.refresh();
    } catch {
      await supabase.storage.from("product-media").remove([storagePath]);
      setState({
        message:
          "The image could not be added. Please try again or contact support.",
      });
    } finally {
      setUploadingListing(null);
    }
  }

  if (!listings.length) return null;
  return (
    <section className="card mt-6 p-6">
      <h2 className="text-xl font-black">Product galleries</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upload up to 8 genuine photos per listing. JPG, PNG or WebP, maximum 5
        MB. Only upload images you own or may legally use.
      </p>
      {listings.map((listing) => (
        <div className="mt-6 border-t pt-5" key={listing.id}>
          <h3 className="font-bold">{listing.productName}</h3>
          <p className="mt-1 text-sm text-slate-600">
            <b>Variant:</b> {listing.variantName} · <b>Branch:</b>{" "}
            {listing.branchName}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {listing.media.map((item) => (
              <figure
                className="overflow-hidden rounded-xl border"
                key={item.id}
              >
                <div className="relative aspect-square">
                  <Image
                    src={item.url}
                    alt={item.altText}
                    fill
                    sizes="(min-width:1024px) 20vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="p-3 text-xs">
                  <p className="line-clamp-2">{item.altText}</p>
                  <div className="mt-2 flex gap-3">
                    {item.isCover ? (
                      <b className="text-brand-700">Cover</b>
                    ) : (
                      <form
                        action={setProductCover.bind(null, item.id, listing.id)}
                      >
                        <button className="font-semibold text-brand-700">
                          Make cover
                        </button>
                      </form>
                    )}
                    <form action={deleteProductImage.bind(null, item.id)}>
                      <button className="font-semibold text-red-700">
                        Delete
                      </button>
                    </form>
                  </div>
                </figcaption>
              </figure>
            ))}
            {!listing.media.length && (
              <p className="text-sm text-slate-500">No product photos yet.</p>
            )}
          </div>
          {listing.media.length < 8 && (
            <form
              onSubmit={(event) => handleUpload(event, listing)}
              className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
            >
              <input
                className="input"
                name="altText"
                required
                minLength={5}
                maxLength={240}
                placeholder="Describe the product photo"
              />
              <input
                className="input"
                name="image"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp"
              />
              <button
                className="btn-secondary"
                disabled={uploadingListing !== null}
              >
                {uploadingListing === listing.id ? "Uploading…" : "Add image"}
              </button>
            </form>
          )}
        </div>
      ))}
      {state.message && (
        <p
          className={`mt-4 text-sm font-semibold ${state.ok ? "text-green-700" : "text-red-700"}`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
