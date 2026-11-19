
export default function Stat({ label, value }) {
  return <div className="stat"><span>{label}</span><strong>{value} <small>mg/dL</small></strong></div>;
}
