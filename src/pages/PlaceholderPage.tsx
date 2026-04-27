interface PlaceholderPageProps {
  title: string
  description?: string
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <h1 className="text-2xl font-semibold text-[#1A1D23] mb-2">{title}</h1>
      {description && <p className="text-sm text-[#5A6270]">{description}</p>}
    </div>
  )
}
