import Image from "next/image"

export type SessionUser = {
  name: string | null
  email: string | null
  image: string | null
}

/** Display name for the signed-in user, with an email-based fallback. */
export function displayNameFor(user: SessionUser) {
  return user.name ?? user.email ?? "Account"
}

/** "Jordan Davis" -> "JD", "naresh01.official" -> "NO", fallback "U". */
export function initialsFor(user: SessionUser) {
  const source = user.name?.trim() || user.email?.split("@")[0] || ""
  const parts = source.split(/[\s._-]+/).filter(Boolean)

  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
}

export function UserAvatar({
  user,
  className = "size-6",
}: {
  user: SessionUser
  className?: string
}) {
  if (user.image) {
    return (
      <Image
        src={user.image}
        alt=""
        width={32}
        height={32}
        className={`${className} shrink-0 rounded-md object-cover`}
      />
    )
  }

  return (
    <span
      className={`${className} grid shrink-0 place-items-center rounded-md bg-secondary font-bold text-primary`}
    >
      {initialsFor(user)}
    </span>
  )
}
