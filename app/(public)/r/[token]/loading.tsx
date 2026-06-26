/** Tracking-page skeleton (shimmer) shown while the report loads. */
export default function TrackingLoading() {
  return (
    <div className="px-5 pb-8 pt-6">
      <div className="skeleton mb-3.5 h-[18px] w-[130px]" />
      <div className="skeleton mb-2 h-6 w-4/5" />
      <div className="skeleton mb-4 h-3.5 w-3/5" />
      <div className="skeleton mb-4 h-[200px] rounded-[20px]" />
      <div className="skeleton mb-2.5 h-12 rounded-btn" />
      <div className="skeleton mb-4 h-12 rounded-btn" />
      <div className="skeleton mb-2.5 h-10 rounded-xl" />
      <div className="skeleton h-[118px] rounded-[18px]" />
    </div>
  );
}
