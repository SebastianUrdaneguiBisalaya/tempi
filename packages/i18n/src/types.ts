/** Same tree as the source locale, with any string as leaf: a locale can't miss or add keys. */
export type Messages<T> = { readonly [K in keyof T]: T[K] extends string ? string : Messages<T[K]> };

/** Dot paths to every leaf, e.g. `validation.required`. */
export type LeafPaths<T, Prefix extends string = ''> = {
	[K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
