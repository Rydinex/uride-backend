export default function Navbar() {
  return (
    <nav className="p-4 bg-white shadow flex justify-between items-center">
      <a href="/" className="text-2xl font-bold">URide</a>

      <div className="flex gap-6">
        <a href="/about">About</a>
        <a href="/pricing">Pricing</a>
        <a href="/contact">Contact</a>
        <a href="/login">Login</a>
      </div>
    </nav>
  );
}
