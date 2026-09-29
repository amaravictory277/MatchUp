"use client";

import { useState, type ImgHTMLAttributes } from "react";

type ProgressiveImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  placeholderClassName?: string;
};

export function ProgressiveImage({ src, alt, className = "", placeholderClassName = "bg-[#0d2945]", ...props }: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={"relative block overflow-hidden " + placeholderClassName}>
      {!loaded ? <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-[#0d2945]" /> : null}
      <img
        {...props}
        src={src || "/placeholder.svg"}
        alt={alt || ""}
        loading={props.loading || "lazy"}
        decoding={props.decoding || "async"}
        onLoad={(event) => {
          setLoaded(true);
          props.onLoad?.(event);
        }}
        className={"relative block size-full object-cover transition-opacity duration-300 " + (loaded ? "opacity-100" : "opacity-0") + " " + className}
      />
    </span>
  );
}
