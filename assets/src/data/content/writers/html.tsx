/* eslint-disable react/display-name */
import { DropdownInput } from 'components/activities/common/delivery/inputs/DropdownInput';
import { HintsBadge } from 'components/activities/common/delivery/inputs/HintsBadge';
import { NumericInput } from 'components/activities/common/delivery/inputs/NumericInput';
import { VlabInput } from 'components/activities/common/delivery/inputs/VlabInput';
import { TextInput } from 'components/activities/common/delivery/inputs/TextInput';
import { MathInput } from 'components/activities/common/delivery/inputs/MathInput';
import { CodeLanguages } from 'components/editing/elements/blockcode/codeLanguages';
import {
  Audio,
  Blockquote,
  Citation,
  CodeLine,
  CodeV1,
  CodeV2,
  Figure,
  Definition as DefinitionModel,
  Pronunciation as DefinitionPronunciationModel,
  Dialog as DialogModel,
  FormulaBlock,
  FormulaInline,
  HeadingFive,
  HeadingFour,
  HeadingOne,
  HeadingSix,
  HeadingThree,
  HeadingTwo,
  Hyperlink,
  ImageBlock,
  ImageInline,
  InputRef,
  ListItem,
  Math,
  MathLine,
  ModelElement,
  OrderedList,
  Paragraph,
  Popup as PopupModel,
  Table,
  TableData,
  TableHeader,
  TableRow,
  UnorderedList,
  Video,
  Webpage,
  YouTube,
  Conjugation as ConjugationModel,
  TableConjugation as TableConjugationModel,
  Foreign,
  CommandButton as CommandButtonModel,
  DescriptionList as DescriptionListModel,
  DescriptionListDefinition,
  DescriptionListTerm,
} from 'data/content/model/elements/types';
import { Mark } from 'data/content/model/text';
import React from 'react';
import { Text } from 'slate';
import { assertNever, valueOr } from 'utils/common';
import {
  MathJaxLatexFormula,
  MathJaxMathMLFormula,
} from '../../../components/common/MathJaxFormula';
import { ContentTable } from '../../../components/ContentTable';
import { cellAttributes } from '../../../components/editing/elements/table/table-util';
import { VideoPlayer } from '../../../components/video_player/VideoPlayer';
import { WriterContext } from './context';
import { Next, WriterImpl, ContentWriter } from './writer';
import { Definition } from '../../../components/common/Definition';
import { Pronunciation } from '../../../components/common/Pronunciation';
import { Figure as FigureElement } from '../../../components/common/Figure';
import { Dialog } from '../../../components/Dialog';
import { Conjugation } from '../../../components/common/Conjugation';
import { TableConjugation } from '../../../components/common/TableConjugation';
import { Popup } from '../../../components/common/Popup';
import { CommandButton } from '../../../components/common/CommandButton';
import { DescriptionList } from '../../../components/common/DescriptionList';

// Important: any changes to this file must be replicated
// in content/html.ex for non-activity rendering.

export class HtmlParser implements WriterImpl {
  private escapeXml = (text: string) => decodeURI(encodeURI(text));

  private wrapWithMarks(text: string, textEntity: Text): React.ReactElement {
    const supportedMarkTags: { [key: string]: (e: React.ReactElement) => React.ReactElement } = {
      em: (e) => <em>{e}</em>,
      strong: (e) => <strong>{e}</strong>,
      mark: (e) => <mark>{e}</mark>,
      del: (e) => <del>{e}</del>,
      var: (e) => <var>{e}</var>,
      code: (e) => <code>{e}</code>,
      sub: (e) => <sub>{e}</sub>,
      sup: (e) => <sup>{e}</sup>,
      term: (e) => <span className="term">{e}</span>,
      underline: (e) => <span style={{ textDecoration: 'underline' }}>{e}</span>,
      strikethrough: (e) => <span style={{ textDecoration: 'line-through' }}>{e}</span>,
    };
    return Object.keys(textEntity)
      .filter((attr: Mark | 'text') => textEntity[attr] === true)
      .map((attr) => supportedMarkTags[attr])
      .filter((mark) => mark)
      .reduce((acc, mark) => mark(acc), <>{text}</>);
  }

  private captioned_content(context: WriterContext, attrs: any, content: React.ReactElement) {
    if (!attrs.caption) {
      return content;
    }
    const caption =
      attrs.caption &&
      (typeof attrs.caption === 'string'
        ? this.escapeXml(attrs.caption)
        : new ContentWriter().render(context, attrs.caption, new HtmlParser()));

    const width = attrs.width ? { width: this.escapeXml(String(attrs.width)) + 'px' } : {};

    return (
      <div className="caption-wrapper" style={width}>
        <figure className="figure embed-responsive text-center">
          {content}
          <figcaption className="figure-caption text-center">{caption}</figcaption>
        </figure>
      </div>
    );
  }

  p(context: WriterContext, next: Next, _x: Paragraph) {
    return <p>{next()}</p>;
  }
  h1(context: WriterContext, next: Next, _x: HeadingOne) {
    return <h1>{next()}</h1>;
  }
  h2(context: WriterContext, next: Next, _x: HeadingTwo) {
    return <h2>{next()}</h2>;
  }
  h3(context: WriterContext, next: Next, _x: HeadingThree) {
    return <h3>{next()}</h3>;
  }
  h4(context: WriterContext, next: Next, _x: HeadingFour) {
    return <h4>{next()}</h4>;
  }
  h5(context: WriterContext, next: Next, _x: HeadingFive) {
    return <h5>{next()}</h5>;
  }
  h6(context: WriterContext, next: Next, _x: HeadingSix) {
    return <h6>{next()}</h6>;
  }

  figure(ctx: WriterContext, next: Next, element: Figure) {
    return (
      <FigureElement context={ctx} title={element.title}>
        {next()}
      </FigureElement>
    );
  }

  dl(context: WriterContext, next: Next, element: DescriptionListModel) {
    return (
      <DescriptionList context={context} description={element}>
        {next()}
      </DescriptionList>
    );
  }

  dd(context: WriterContext, next: Next, _element: DescriptionListDefinition) {
    return <dd>{next()}</dd>;
  }

  dt(context: WriterContext, next: Next, _element: DescriptionListTerm) {
    return <dt>{next()}</dt>;
  }

  conjugation(context: WriterContext, next: Next, element: ConjugationModel) {
    const writer = new ContentWriter();

    const pronunciation =
      element.pronunciation && writer.render(context, element.pronunciation, new HtmlParser());

    const table = element.table && writer.render(context, element.table, new HtmlParser());

    return <Conjugation conjugation={element} pronunciation={pronunciation} table={table} />;
  }

  definitionMeaning(context: WriterContext, next: Next, _: any) {
    return <li className="meaning">{next()}</li>;
  }

  definitionTranslation(context: WriterContext, next: Next, _: any) {
    return <span className="translation">{next()} </span>;
  }

  definitionPronunciation(
    context: WriterContext,
    next: Next,
    pronunciation: DefinitionPronunciationModel,
  ) {
    return <Pronunciation pronunciation={pronunciation} next={next} />;
  }

  definition(context: WriterContext, next: Next, definition: DefinitionModel) {
    const writer = new ContentWriter();

    // Need to use a ContentWriter to recursively render the parts of the definition
    const meanings =
      definition.meanings && writer.render(context, definition.meanings, new HtmlParser());

    const pronunciation =
      definition.pronunciation &&
      writer.render(context, definition.pronunciation, new HtmlParser());

    const translations =
      definition.translations && writer.render(context, definition.translations, new HtmlParser());

    return (
      <Definition
        definition={definition}
        meanings={meanings}
        pronunciation={pronunciation}
        translations={translations}
      />
    );
  }

  dialog(context: WriterContext, next: Next, dialog: DialogModel) {
    return <Dialog dialog={dialog} context={context} />;
  }

  foreign(ctx: WriterContext, next: Next, element: Foreign) {
    return (
      <span className="foreign" lang={element.lang || ctx.learningLanguage}>
        {next()}
      </span>
    );
  }

  formula(ctx: WriterContext, next: Next, element: FormulaBlock | FormulaInline) {
    const forceBlockRendering =
      element.legacyBlockRendered !== undefined && element.legacyBlockRendered;
    switch (element.subtype) {
      case 'latex':
        return (
          <MathJaxLatexFormula
            src={element.src}
            inline={element.type === 'formula_inline' && !forceBlockRendering}
          />
        );
      case 'mathml':
        return (
          <MathJaxMathMLFormula src={element.src} inline={element.type === 'formula_inline'} />
        );
      default:
        return <span className="formula">Unknown formula type</span>;
    }
  }

  formulaInline(ctx: WriterContext, next: Next, element: FormulaInline) {
    return this.formula(ctx, next, element);
  }

  img(context: WriterContext, next: Next, attrs: ImageBlock) {
    if (!attrs.src) return <></>;

    return this.captioned_content(
      context,
      attrs,
      <img
        className="figure-img img-fluid"
        alt={attrs.alt ? this.escapeXml(attrs.alt) : ''}
        src={this.escapeXml(attrs.src)}
      />,
    );
  }
  img_inline(context: WriterContext, next: Next, attrs: ImageInline) {
    if (!attrs.src) return <></>;

    return (
      <img
        className="img-fluid"
        alt={attrs.alt ? this.escapeXml(attrs.alt) : ''}
        width={attrs.width ? this.escapeXml(String(attrs.width)) : undefined}
        src={this.escapeXml(attrs.src)}
      />
    );
  }

  video(context: WriterContext, next: Next, attrs: Video) {
    return <VideoPlayer video={attrs} />;
  }

  youtube(context: WriterContext, next: Next, attrs: YouTube) {
    if (!attrs.src) return <></>;

    return this.iframe(context, next, {
      ...attrs,
      src: `https://www.youtube.com/embed/${this.escapeXml(attrs.src)}`,
    });
  }
  iframe(context: WriterContext, next: Next, attrs: Webpage | YouTube) {
    if (!attrs.src) return <></>;

    return this.captioned_content(
      context,
      attrs,
      <div className="embed-responsive embed-responsive-16by9">
        <iframe className="embed-responsive-item" allowFullScreen src={this.escapeXml(attrs.src)} />
      </div>,
    );
  }
  audio(context: WriterContext, next: Next, attrs: Audio) {
    if (!attrs.src) return <></>;

    return this.captioned_content(
      context,
      attrs,
      <audio aria-label={attrs.alt || ''} controls src={this.escapeXml(attrs.src)}>
        Your browser does not support the <code>audio</code> element.
      </audio>,
    );
  }
  table(context: WriterContext, next: Next, attrs: Table) {
    const caption =
      attrs.caption &&
      (typeof attrs.caption === 'string'
        ? this.escapeXml(attrs.caption)
        : new ContentWriter().render(context, attrs.caption, new HtmlParser()));

    return (
      <ContentTable model={attrs}>
        {attrs.caption ? <caption>{caption}</caption> : undefined}
        {next()}
      </ContentTable>
    );
  }
  callout(context: WriterContext, next: Next) {
    return <div className="callout-block">{next()}</div>;
  }

  calloutInline(context: WriterContext, next: Next) {
    return <span className="callout-inline">{next()}</span>;
  }

  tr(context: WriterContext, next: Next, _x: TableRow) {
    return <tr>{next()}</tr>;
  }

  th(context: WriterContext, next: Next, attrs: TableHeader) {
    return <th {...cellAttributes(attrs)}>{next()}</th>;
  }
  td(context: WriterContext, next: Next, attrs: TableData) {
    return <td {...cellAttributes(attrs)}>{next()}</td>;
  }
  tc(context: WriterContext, next: Next, attrs: TableConjugationModel) {
    return <TableConjugation attrs={attrs}>{next()}</TableConjugation>;
  }
  ol(context: WriterContext, next: Next, item: OrderedList) {
    return item.style ? <ol className={`list-${item.style}`}>{next()}</ol> : <ol>{next()}</ol>;
  }
  ul(context: WriterContext, next: Next, item: UnorderedList) {
    return item.style ? <ul className={`list-${item.style}`}>{next()}</ul> : <ul>{next()}</ul>;
  }
  li(context: WriterContext, next: Next, _x: ListItem) {
    return <li>{next()}</li>;
  }
  math(context: WriterContext, next: Next, _x: Math) {
    return <div>{next()}</div>;
  }
  mathLine(context: WriterContext, next: Next, _x: MathLine) {
    return next();
  }
  code(context: WriterContext, next: Next, attrs: CodeV1 | CodeV2) {
    const language = this.escapeXml(attrs.language);
    const langClass = CodeLanguages.byPrettyName(language).highlightJs;
    if ('code' in attrs) return this.codev2(context, next, attrs as CodeV2, langClass);
    return this.codev1(context, next, attrs as CodeV1, langClass);
  }
  codev1(context: WriterContext, next: Next, attrs: CodeV1, className: string) {
    return this.captioned_content(
      context,
      attrs,
      <pre>
        <code className={`language-${className}`}>{next()}</code>
      </pre>,
    );
  }
  codev2(context: WriterContext, _next: Next, attrs: CodeV2, className: string) {
    return this.captioned_content(
      context,
      attrs,
      <pre>
        <code className={`language-${className}`}>{this.escapeXml(attrs.code)}</code>
      </pre>,
    );
  }
  codeLine(context: WriterContext, next: Next, _x: CodeLine) {
    return (
      <>
        {next()}
        {'\n'}
      </>
    );
  }
  blockquote(context: WriterContext, next: Next, _x: Blockquote) {
    return <blockquote>{next()}</blockquote>;
  }
  a(context: WriterContext, next: Next, { href }: Hyperlink) {
    if (href.startsWith('/course/link/')) {
      let internalHref = href;
      if (context.sectionSlug) {
        const revisionSlug = href.replace(/^\/course\/link\//, '');
        internalHref = `/sections/${context.sectionSlug}/page/${revisionSlug}`;
      } else {
        internalHref = '#';
      }

      return (
        <a className="internal-link" href={this.escapeXml(internalHref)}>
          {next()}
        </a>
      );
    }

    return (
      <a className="external-link" href={this.escapeXml(href)} target="_blank" rel="noreferrer">
        {next()}
      </a>
    );
  }

  commandButton(context: WriterContext, next: Next, attrs: CommandButtonModel) {
    return <CommandButton commandButton={attrs}>{next()}</CommandButton>;
  }

  inputRef(context: WriterContext, _next: Next, inputRef: InputRef) {
    const { inputRefContext } = context;
    const inputData = inputRefContext?.inputs.get(inputRef.id);
    if (!inputRefContext || !inputData) {
      return <TextInput onKeyUp={() => {}} onChange={() => {}} value="" disabled />;
    }

    const shared = {
      onChange: (value: string) => inputRefContext.onChange(inputRef.id, value),
      onBlur: () => inputRefContext.onBlur(inputRef.id),
      onKeyUp: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
          inputRefContext.onPressEnter(inputRef.id);
        }
      },
      value: valueOr(inputData.value, ''),
      disabled: inputRefContext.disabled,
      placeholder: inputData.placeholder || '',
    };

    const withHints = (element: React.ReactElement) => (
      <>
        {element}
        <HintsBadge
          hasHints={inputData.hasHints}
          toggleHints={() => inputRefContext.toggleHints(inputData.input.id)}
        />
      </>
    );

    switch (inputData.input.inputType) {
      case 'numeric':
        return withHints(<NumericInput {...shared} />);
      case 'text':
        return withHints(<TextInput {...shared} />);
      case 'math':
        return withHints(<MathInput {...shared} inline />);
      case 'vlabvalue':
        return withHints(<VlabInput {...shared} />);
      case 'dropdown':
        return withHints(
          <DropdownInput
            {...shared}
            options={inputData.input.options}
            selected={inputData.value}
          />,
        );
      default:
        assertNever(inputData.input);
    }
  }

  popup(context: WriterContext, anchorNext: Next, contentNext: Next, popup: PopupModel) {
    return (
      <Popup popup={popup} popupContent={contentNext()}>
        {anchorNext()}
      </Popup>
    );
  }

  private executeScroll(slug: string) {
    const d = document.getElementById(slug);
    if (d && d.scrollIntoView) {
      d.scrollIntoView();
    }
  }

  cite(context: WriterContext, next: Next, x: Citation) {
    if (context.bibParams) {
      const bibEntry = context.bibParams.find((el: any) => el.id === x.bibref);
      if (bibEntry) {
        return (
          <cite>
            <sup>
              [
              <a onClick={() => this.executeScroll(bibEntry.slug)} href={`#${bibEntry.slug}`}>
                {bibEntry.ordinal}
              </a>
              ]
            </sup>
          </cite>
        );
      }
    }
    return (
      <cite>
        <sup>{next()}</sup>
      </cite>
    );
  }

  text(context: WriterContext, textEntity: Text) {
    return this.wrapWithMarks(textEntity.text, textEntity);
  }
  unsupported(_context: WriterContext, x: ModelElement) {
    console.error('Content element ' + JSON.stringify(x) + ' is invalid and could not display.');
    return <div className="content invalid">Content element is invalid</div>;
  }
}
