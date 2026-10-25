import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <h1>Бет табылмады</h1>
      <p>
        Сілтеме қате болуы мүмкін. <Link to="/">Басты бетке</Link> оралыңыз.
      </p>
    </div>
  );
}
