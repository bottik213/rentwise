/** Shown while localStorage is read on the client (server render and hydration). */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="skel animate-pulse">
      <span style={{ height: 56, width: "min(420px, 100%)" }} />
      <span style={{ height: 200 }} />
      <span />
    </div>
  );
}
