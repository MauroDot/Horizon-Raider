// Shared 1-3 star rating readout - used by the campaign mission list, the
// mission briefing screen's best-record line, and GameOver's result panel,
// so all three render identically.
export function Stars({ count, max = 3 }) {
  return (
    <span className="star-rating">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? 'star filled' : 'star'}>
          {i < count ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}
