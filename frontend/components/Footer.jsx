export default function Footer() {
  return (
    <footer className="border-t bg-white py-6 px-4">
      <div className="mx-auto max-w-6xl text-sm text-gray-600 flex flex-col sm:flex-row justify-between gap-2">
        <p>Copyright {new Date().getFullYear()} URide. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="/about">About</a>
          <a href="/pricing">Pricing</a>
          <a href="/contact">Contact</a>
        </div>
      </div>
    </footer>
  );
}
