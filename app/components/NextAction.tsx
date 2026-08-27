import Link from "./NativeLink";
import { Icon } from "./Icon";

export function NextAction({
  eyebrow = "NEXT ACTION",
  title,
  detail,
  href,
  label,
}: {
  eyebrow?: string;
  title: string;
  detail: string;
  href: string;
  label: string;
}) {
  return (
    <div className="next-action-card">
      <div>
        <span className="mono-label">{eyebrow}</span>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <Link className="button button-primary button-sm" href={href} prefetch={false}>
        {label}
        <Icon name="arrowRight" size={14} />
      </Link>
    </div>
  );
}
