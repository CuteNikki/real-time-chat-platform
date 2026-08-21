import type { Metadata } from 'next';

import { NotFoundView } from '@/components/not-found-view';

export const metadata: Metadata = {
  title: 'Page not found',
  description: "The page you're looking for doesn't exist or has moved.",
};

export default function NotFound() {
  return <NotFoundView />;
}
