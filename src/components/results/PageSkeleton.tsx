/** Shown while localStorage is read on the client (server render and hydration). */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto max-w-6xl animate-pulse px-4 py-14 sm:px-6">
      <div className="h-9 w-72 rounded-sm bg-surface" />
      <div className="mt-4 h-4 w-96 max-w-full rounded-sm bg-surface" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-md bg-surface" />)}
      </div>
    </div>
  );
}
