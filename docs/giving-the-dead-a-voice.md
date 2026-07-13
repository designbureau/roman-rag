# Giving the Dead a Voice

*On the ethics of animating historical figures as retrieval-grounded
personas.*

---

## 1. What these voices are

The Archive lets you address its texts through several voices: the
Classicist, a scholarly framer who reads across the whole collection, and the
historical figures themselves: Cicero, Caesar, Augustus, Seneca, Marcus
Aurelius. Speaking to a dead man in his own voice is an old and uneasy
pleasure. It is worth setting out plainly what these personas are, what they
may do, and what they must never do.

They are not séances, and they are not resurrections. A persona here is a
reading device: a way of asking what a body of writing contains, angled
through a point of view. When you ask Augustus how he came to power, you are
not hearing Augustus. You are hearing a synthesis constrained to speak only
from his surviving words (in his case, just forty sections of official
self-account), in a voice shaped to resemble the man those words reveal. The
distinction is the whole ethical foundation of the thing, and it has to be
enforced rather than merely asserted. In this Archive it is enforced
structurally: each figure's retrieval is filtered to his own works, so the
system cannot quote to him what he could never have read.

## 2. An old device: the personas as prosopopoeia

Putting speech into an absent or dead person's mouth is not an invention of
machine learning. Classical rhetoric named the device *prosopopoeia*, the
"making of a face", the fashioning of a person, and the authors in this
Archive were its masters and its theorists. The figure has a long theoretical
afterlife, from the rhetorical handbooks through its medieval and early-modern
elaboration as personification (Paxson 1994; Lausberg 1998), but its ancient
form is the one that bears on this system: the deliberate, announced
construction of a voice for someone not present to speak.

Cicero used it at the hinges of his greatest speeches. In the First
Catilinarian he makes the *patria*, Rome herself, rise and address Catiline
directly. In the *Pro Caelio* he does something closer to what this Archive
does: he summons a specific dead individual, Appius Claudius Caecus, the
stern ancestor of the scandalous Clodia, "from the underworld" (*ab inferis*)
to rebuke his descendant. The jury knew Appius was dead; the power of the
device lay precisely in everyone knowing the voice was constructed, and
judging whether it was constructed *faithfully*: whether this was what old
Appius would have said.

Quintilian, whose treatise on oratory sits in this same Archive awaiting
embedding, gives the device its rulebook (*Institutio Oratoria* 9.2). He
calls impersonations *fictiones personarum*, credits them with the power to
"bring down the gods from heaven and raise the dead," and attaches a
condition: the invented speech must fit the person, and it persuades only so
far as it stays within what the person plausibly could have said. An
impersonation that outruns its subject's character or knowledge fails as
rhetoric, on Quintilian's own terms.

That, almost exactly, is the design rule of this system. The personas are
digital prosopopoeia, and retrieval-grounding is Quintilian's fidelity
condition made mechanical: the voice may say only what the surviving record
supports. The classical tradition also supplies the emblem for the whole
enterprise. When Petrarch rediscovered Cicero's letters to Atticus in 1345,
his first act was to write Cicero a letter back (*Familiares* 24.3). The urge
to answer a voice in an archive is as old as reading; what is new is a
machine fluent enough to answer on the archive's behalf, which is why the
constraints below matter more here than they ever did in rhetoric.

## 3. The three rules

**The first rule is bounded knowledge.** Each figure knows what they knew in
their own life, and no more. Cicero cannot tell you how he died; Caesar
cannot speak of what followed the Ides of March; Augustus does not narrate
the empire after him; Marcus Aurelius does not foretell the future. Each is
scoped, too, to their own writing. Marcus reasons from his *Meditations*,
not from Cicero's letters, and the retrieval filter makes this physical: the
other authors' texts are simply never placed before him. When a question runs
past the edge of what a figure could know, the correct answer is that they
cannot say, and the personas are built to give that answer, in voice, rather
than improvise a plausible one. A persona that cannot admit ignorance will
sooner or later produce a confident falsehood.

The bound is hardest exactly where the underlying language model is most
knowledgeable. Any modern model "knows" how Caesar died; it has read the
assassination ten thousand times. The persona must refuse what the model can
easily supply: the temptation is completion from everywhere rather than
invention from nothing, and resisting it takes both prompt discipline and
the structural fact that retrieval never furnishes the forbidden material.

**The second rule is that nothing is invented.** The personas do not compose
new letters, speeches, meditations, or sayings and attribute them to the
dead. This is the sharpest line, because it is the most tempting to cross: a
fluent model can produce a sentence that sounds exactly like Cicero, and
such a sentence, once written, is a forgery. Classical studies has spent five
centuries unmasking exactly this artefact; the pseudo-Ciceronian *Consolatio*
forged in the 1580s fooled some of the best Latinists alive. The Archive
grounds every substantive claim in retrieved passages, so that what a persona
reports can be traced to what the figure actually wrote. Where the persona
characterises or paraphrases, it should read as characterisation rather than
be passed off as the record.

**The third rule is respect for the difference between animating a record
and ventriloquising a person.** These were real people, with families,
enemies, vanities, and, several of them, violent ends. The people around
them were real too: the wives and children, the enslaved copyists and
letter-carriers whose labour made the correspondence physically possible, and
of whom the record preserves almost nothing in their own words. It would be
easy, and wrong, to put confident speech into mouths the record never
preserved. The persona system is therefore weighted towards the figures who
left a corpus, and towards candour about how partial even that corpus is: one
side of a correspondence, a general's own dispatches, an emperor's chosen
account of himself.

## 4. The modern hazard

A contemporary literature has grown up around "deathbots" and "griefbots",
generative simulations of the dead, usually of the recently dead, built from
their messages and voice notes (Hollanek & Nowaczyk-Basińska 2024; Öhman &
Floridi 2017; Stokes 2021). Its central worries are consent, the dignity of
the dead, the vulnerability of the grieving, and the commercial capture of
memory; Öhman & Floridi (2018) propose an ethical framework for what they call
the digital afterlife industry, arguing by analogy with the regulated dignity
of human remains that a person's informational legacy should not be freely
exploited for the benefit of the living. The figures in this Archive are two
thousand years dead, publicly known, and represented only through texts they
published or that history published for them, so the sharpest of those
concerns (consent from the subject, protection of the grieving, commercial
capture of a private person's memory) do not transfer. But two of them do.

The first is the seduction of fluency. Shanahan, McDonell and Reynolds (2023)
describe large-language-model personas as role-play without an inner life:
a performance that invites the interlocutor to over-attribute. A first-person
Caesar answering in confident prose lends generated sentences an authority no
disclaimer fully counters. The Archive's mitigations are structural rather
than decorative: citations are always visible beside the reply, refusals
happen in voice and often, and the speech interface deliberately keeps the
text on screen as text; the bust does not move its lips.

The second is authority laundering. A synthesis grounded in the *Res Gestae*
is grounded in propaganda; a persona scoped to Caesar's *Commentarii*
reproduces the perspective of a man justifying his own conquests, including
the subjugation of Gaul as he chose to narrate it. Fidelity to the record
does not amount to neutrality, because the record itself is not neutral.
The Classicist exists for exactly this reason: a voice outside the ensemble
whose explicit job is to say what kind of document a text is (advocacy,
selection, self-address) and what it leaves out.

## 5. From stone to skin

The Archive's next step makes the gradient concrete. Two motion studies
exist: in the first, the marble bust of Marcus Aurelius, the same likeness
that stands in the gallery's ring, speaks. The stone moves, and remains
unmistakably stone: sculpted eyes, carved curls, a statue talking. In the
second, Caesar has been given back his face (skin, hair, grey eyes), a
photorealistic reconstruction generated from the Tusculum portrait, the one
surviving portrait type generally accepted as carved during his lifetime.
Both are startling. They are not, ethically, the same object.

![Motion study I (Marcus Aurelius): the marble speaks; midway through, the stone is given living eyes.](/video/marcus.mp4)

The speaking statue is prosopopoeia in its most literal form: the "made
face" that announces itself as made. No viewer mistakes talking marble for a
living man; the artifice is the aesthetic, exactly as it was when Cicero made
the *patria* speak. It raises the register of the encounter without raising
its claim to reality, and it can be adopted on the same terms as the personas
themselves.

The Marcus study does not stay on its own side of the line, though, and the
way it crosses repays attention. Halfway through, the sculpted eyes are
replaced with living ones (irises, pupils, moisture) while every other
surface stays marble. The effect is disproportionate to the change: a talking
statue with stone eyes reads as a device; the same statue with human eyes
reads, suddenly, as inhabited. One signal, a few square centimetres of the
image, moves the object most of the way across the gradient on its own. For
the design the implication is that presence does not scale with how much of
the surface is made realistic: perceived animacy concentrates in the eyes,
which is why the uncanny-valley literature keeps returning to gaze (Mori 1970;
Mori, MacDorman & Kageki 2012). The point is not merely anecdotal: empirical
work on androids finds that mismatches concentrated in the eyes and their
motion are disproportionately responsible for the descent into the valley,
and that a face made *almost* human is judged more unsettling than one
plainly artificial (MacDorman & Ishiguro 2006). The marble-with-living-eyes
study is a controlled instance of exactly that effect: hold every other
surface at "plainly sculpture" and change only the eyes, and the object slides
from device to inhabited on the strength of that one signal.

There is also a strange historical footnote here: the blank white stare we
call "classical" is largely an accident of survival. Roman marbles were
painted, bronzes carried inlaid eyes of glass and stone, and Antonine
sculptors incised iris and pupil into the marble itself (Abbe 2015). An
ancient viewer never met the empty gaze we know; in giving Marcus his eyes
back, the study is in one sense restoring the ancient viewing experience
rather than departing from it. That does not remove the startle, but it
relocates it: part of what unsettles a modern viewer is the habit of
expecting ancient sculpture to look blind.

![Motion study II (Caesar): a photoreal reconstruction, with skin, hair, and eyes, generated from the Tusculum portrait.](/video/caesar.mp4)

The fleshed Caesar sits differently. A photoreal face is the native format of
the deepfake, and its whole power is that the device disappears: the viewer
is invited to feel, however briefly, that they are being looked at by Julius
Caesar rather than by a rendering derived from a marble he may once have
sat for. Two things keep it on the right side of the line, and both need to
be visible as well as true. The first is grounding: the reconstruction stands
to the Tusculum portrait as a grounded answer stands to a retrieved passage,
inference from the surviving record (a lifetime likeness, in this case),
never a face invented free-hand. That is the same fidelity condition
Quintilian attached to the spoken device, applied to appearance. The second
is framing: the source portrait named, the method stated, the same bounded
voice and in-voice refusals behind the face. The working rule the Archive
adopts is that the realism of the surface may never outrun the legibility of
the device: the more life-like the reproduction, the more clearly the
scaffolding must show. A statue can simply speak; a photoreal face has to
declare what it is first.

## 6. Why do it at all

If the risks are this sharp, why give the dead a voice at all? Because a
voice invites a kind of attention a search box does not. Asked to speak as a
figure, the system must locate the relevant passages, weigh them, and present
them in the first person, and a reader, hearing that, reads the sources more
closely than they otherwise might. The persona is a lure towards the text
rather than a substitute for it.

The classical tradition, again, got here first. Quintilian recommended
prosopopoeia to students as a discipline: to speak credibly in another's
character, you must first master what that person said and how they thought.
The exercise serves the sources. Handled with these constraints (bounded
knowledge, nothing invented, the record's partiality kept in view), giving
the dead a voice becomes a form of citation, performed out loud.

---

## References

- Abbe, M. (2015). Polychromy. In E. A. Friedland, M. G. Sobocinski &
  E. K. Gazda (eds.), *The Oxford Handbook of Roman Sculpture*. Oxford
  University Press.
- Cicero, *In Catilinam* 1.18, 1.27 (the *patria* addresses Catiline);
  *Pro Caelio* 33–34 (Appius Claudius Caecus raised *ab inferis*).
- Quintilian, *Institutio Oratoria* 9.2.29–37 (*fictiones personarum*);
  3.8.49–54 (speaking in character as an exercise in fidelity).
- Petrarca, F. *Epistolae Familiares* 24.3 (letter to Cicero, Verona, 1345).
- Hollanek, T. & Nowaczyk-Basińska, K. (2024). Griefbots, Deadbots,
  Postmortem Avatars: on Responsible Applications of Generative AI in the
  Digital Afterlife Industry. *Philosophy & Technology* 37.
- Lausberg, H. (1998). *Handbook of Literary Rhetoric*. Brill. (On
  prosopopoeia and *sermocinatio*.)
- MacDorman, K. F. & Ishiguro, H. (2006). The uncanny advantage of using
  androids in cognitive and social science research. *Interaction Studies*
  7(3), 297–337.
- Mori, M. (1970). The Uncanny Valley. *Energy* 7(4), 33–35. (English
  translation: Mori, M., MacDorman, K. F. & Kageki, N. (2012). The Uncanny
  Valley [From the Field]. *IEEE Robotics & Automation Magazine* 19(2),
  98–100.)
- Öhman, C. & Floridi, L. (2017). The Political Economy of Death in the Age
  of Information: A Critical Approach to the Digital Afterlife Industry.
  *Minds and Machines* 27, 639–662.
- Öhman, C. & Floridi, L. (2018). An ethical framework for the digital
  afterlife industry. *Nature Human Behaviour* 2, 318–320.
- Paxson, J. J. (1994). *The Poetics of Personification*. Cambridge
  University Press.
- Shanahan, M., McDonell, K. & Reynolds, L. (2023). Role play with large
  language models. *Nature* 623, 493–498.
- Stokes, P. (2021). *Digital Souls: A Philosophy of Online Death*.
  Bloomsbury.
- Zanker, P. (2009). The Irritating Statues and Contradictory Portraits of
  Julius Caesar. In M. Griffin (ed.), *A Companion to Julius Caesar*.
  Wiley-Blackwell. (On the Tusculum portrait, found in 1825 and now in
  Turin: the portrait type generally accepted as made in Caesar's
  lifetime.)
- Zhou, L. et al. (2025). PersonaEval: Are LLM Evaluators Human Enough to
  Judge Role-Play? arXiv:2508.10014.
