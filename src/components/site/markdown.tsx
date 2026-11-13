import ReactMarkdown from 'react-markdown'

/**
 * Markdown rendering for tenant content.
 * react-markdown never renders raw HTML, so user content cannot inject
 * scripts — safe by construction.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="ocs-prose">
      <ReactMarkdown
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
