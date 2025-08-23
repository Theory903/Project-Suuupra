import Link from 'next/link';

export function PublicFooter() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold">Suuupra</span>
            </div>
            <p className="text-gray-400">
              Empowering learners worldwide with cutting-edge educational technology.
            </p>
            <div className="flex space-x-4">
              <Link href="/status" className="text-gray-400 hover:text-white text-sm">
                System Status
              </Link>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="font-semibold mb-4">Platform</h3>
            <div className="space-y-2">
              <Link href="/courses" className="block text-gray-400 hover:text-white text-sm">
                Courses
              </Link>
              <Link href="/live" className="block text-gray-400 hover:text-white text-sm">
                Live Classes
              </Link>
              <Link href="/creators/sign-up" className="block text-gray-400 hover:text-white text-sm">
                Become a Creator
              </Link>
              <Link href="/pricing" className="block text-gray-400 hover:text-white text-sm">
                Pricing
              </Link>
            </div>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <div className="space-y-2">
              <Link href="/help" className="block text-gray-400 hover:text-white text-sm">
                Help Center
              </Link>
              <Link href="/contact" className="block text-gray-400 hover:text-white text-sm">
                Contact Us
              </Link>
              <Link href="/community" className="block text-gray-400 hover:text-white text-sm">
                Community
              </Link>
              <Link href="/api-docs" className="block text-gray-400 hover:text-white text-sm">
                API Documentation
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <div className="space-y-2">
              <Link href="/privacy" className="block text-gray-400 hover:text-white text-sm">
                Privacy Policy
              </Link>
              <Link href="/terms" className="block text-gray-400 hover:text-white text-sm">
                Terms of Service
              </Link>
              <Link href="/cookies" className="block text-gray-400 hover:text-white text-sm">
                Cookie Policy
              </Link>
              <Link href="/about" className="block text-gray-400 hover:text-white text-sm">
                About Us
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; 2024 Suuupra. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
