import Image from "next/image";

export default function Header() {
  return (
    <div className="text-center pt-6 pb-5">
      <Image
        src="/logo-moka.png"
        alt="MÖKA Drive"
        width={1930}
        height={461}
        priority
        className="h-14 w-auto mx-auto"
      />
    </div>
  );
}
