import { Link } from '@tanstack/react-router';
import type { ComponentProps, Ref } from 'react';

/** A URL with a scheme or host, ex. a download, rather than a path in Studio */
const externalUrl = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;

/**
 * The link Astryx components render, set with `LinkProvider`: Studio's paths navigate with the router, and other
 * URLs are plain anchors so the router doesn't treat them as routes.
 */
export function RouterLink({
	href,
	to,
	ref,
	children,
	...props
}: Omit<ComponentProps<'a'>, 'ref'> & { to?: string; ref?: Ref<HTMLAnchorElement> }) {
	const destination = to ?? href;
	if (destination === undefined || externalUrl.test(destination)) {
		return (
			<a ref={ref} href={destination} {...props}>
				{children}
			</a>
		);
	}
	return (
		<Link ref={ref} to={destination} {...props}>
			{children}
		</Link>
	);
}
